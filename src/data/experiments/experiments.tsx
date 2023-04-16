/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import Notif from "components/Notif.vue";
import breeding from "data/breeding/breeding";
import { createCollapsibleModifierSections } from "data/common";
import flowers from "data/flowers/flowers";
import generators from "data/generators/generators";
import { JobKeys, main } from "data/projEntry";
import study from "data/study/study";
import { createClickable, GenericClickable } from "features/clickables/clickable";
import { Component, GatherProps, GenericComponent, jsx, JSXFunction } from "features/feature";
import { createJob } from "features/job/job";
import { createAchievement, GenericAchievement } from "features/achievements/achievement";
import MainDisplay from "features/resources/MainDisplay.vue";
import {
    createResource,
    displayResource,
    Resource,
    unwrapResource
} from "features/resources/resource";
import { createTab } from "features/tabs/tab";
import { createTabFamily } from "features/tabs/tabFamily";
import { addTooltip } from "features/tooltips/tooltip";
import { addLayer, BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { createDismissableNotify } from "game/notifications";
import type { Persistent } from "game/persistence";
import { persistent } from "game/persistence";
import player from "game/player";
import settings from "game/settings";
import Decimal, { DecimalSource, format } from "util/bignum";
import { formatWhole } from "util/break_eternity";
import { WithRequired } from "util/common";
import { Computable, convertComputable, ProcessedComputable } from "util/computed";
import { getFirstFeature, render, renderCol, renderColJSX, renderJSX, trackHover } from "util/vue";
import { computed, ComputedRef, Ref, unref, watch } from "vue";
import { useToast } from "vue-toastification";
import type { ToastID } from "vue-toastification/dist/types/types";
import distill from "../distill/distill";
import globalQuips from "../quips.json";
import AppliedTimeSelectors from "./AppliedTimeSelectors.vue";
import "./experiments.css";
import Grains from "./Grains.vue";
import Hourglass from "./Hourglass.vue";
import alwaysQuips from "./quips.json";
import { createBooleanRequirement } from "game/requirements";

const toast = useToast();

export interface PotentialOptions {
    name: string;
    precision?: number;
    effectRatio: Computable<DecimalSource>;
    xpReqRatio: Computable<DecimalSource>;
    baseBoostCost: Computable<DecimalSource>;
    boostCostRatio: Computable<DecimalSource>;
    boostCostResource: Computable<Resource>;
    modifierType?: keyof typeof modifierSymbols;
    isAdvanced?: boolean;
}

export interface Potential {
    level: Persistent<number>;
    xp: Persistent<number>;
    xpRequired: Ref<Decimal>;
    effect: () => Decimal;
    modifier: Modifier;
    boosts: Persistent<number>;
    cost: Ref<Decimal>;
    clickable: GenericClickable;
    showNotif: Ref<boolean>;
    effectRatio: ProcessedComputable<DecimalSource>;
    xpReqRatio: ProcessedComputable<DecimalSource>;
    baseBoostCost: ProcessedComputable<DecimalSource>;
    boostCostRatio: ProcessedComputable<DecimalSource>;
    boostCostResource: ProcessedComputable<Resource>;
    update: (diff: number) => void;
    display: JSXFunction;
}

const modifierSymbols = {
    additive: "+",
    multiplicative: "x",
    exponential: "^"
};
const modifierEffects = {
    additive: (ratio: ProcessedComputable<DecimalSource>, level: Ref<DecimalSource>) => () =>
        Decimal.times(unref(ratio), level.value),
    multiplicative: (ratio: ProcessedComputable<DecimalSource>, level: Ref<DecimalSource>) => () =>
        Decimal.pow(unref(ratio), level.value),
    exponential: (ratio: ProcessedComputable<DecimalSource>, level: Ref<DecimalSource>) => () =>
        Decimal.tetrate(unref(ratio), new Decimal(level.value).toNumber())
};

const id = "experiments";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Measuring";
    const color = "#D1C926";

    const potentia = createResource<DecimalSource>(0, "potentia");
    const baseTotalGrains = persistent<DecimalSource>(1);
    const grainsFallen = persistent<DecimalSource>(0);
    const flippingProgress = persistent<number>(1);
    const chippingProgress = persistent<number>(0);
    const selectedJob = persistent<JobKeys>("experiments");

    const potentialsNotif = computed(() => {
        if (!potentialsMilestone.earned.value) {
            return false;
        }
        if (Object.values(basicPotentials).some(p => p.showNotif.value)) {
            return true;
        }
        if (!advancedPotentialsMilestone.earned.value) {
            return false;
        }
        if (Object.values(advancedPotentials).some(p => p.showNotif.value)) {
            return true;
        }
        return false;
    });

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "85%",
            y: "60%"
        },
        symbol: "⧖",
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: potentia,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        visibility: distill.milestones.experimentsMilestone.earned,
        showNotif: () => showHourglassNotif.value || potentialsNotif.value
    }));

    const chippingMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 2)),
        display: {
            requirement: `Achieve ${job.name} Level 2`,
            effectDisplay: "Unlock grinding grains"
        }
    }));
    const potentialsMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 4)),
        display: {
            requirement: `Achieve ${job.name} Level 4`,
            effectDisplay: "Unlock potentials"
        },
        visibility: chippingMilestone.earned
    }));
    const timeSlotMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 5)),
        display: {
            requirement: `Achieve ${job.name} Level 5`,
            effectDisplay: "Unlock a time slot"
        },
        visibility: potentialsMilestone.earned
    }));
    const advancedPotentialsMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 6)),
        display: {
            requirement: `Achieve ${job.name} Level 6`,
            effectDisplay: "Unlock advanced potentials"
        },
        visibility: timeSlotMilestone.earned
    }));
    const appliedTimeMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 8)),
        display: {
            requirement: `Achieve ${job.name} Level 8`,
            effectDisplay: "Unlock applied time"
        },
        visibility: advancedPotentialsMilestone.earned
    }));
    const jobMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 10)),
        display: {
            requirement: `Achieve ${job.name} Level 10`,
            effectDisplay: 'Unlock "Harnessing Power" Job'
        },
        visibility: appliedTimeMilestone.earned,
        onComplete() {
            addLayer(generators, player);
        }
    })) as GenericAchievement;
    const milestones = {
        chippingMilestone,
        potentialsMilestone,
        timeSlotMilestone,
        advancedPotentialsMilestone,
        appliedTimeMilestone,
        jobMilestone
    };
    const orderedMilestones = [
        jobMilestone,
        appliedTimeMilestone,
        advancedPotentialsMilestone,
        timeSlotMilestone,
        potentialsMilestone,
        chippingMilestone
    ];
    const collapseMilestones = persistent<boolean>(true);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature, collapsedContent, hasCollapsedContent } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    function createPotential({
        name,
        precision,
        effectRatio,
        xpReqRatio,
        baseBoostCost,
        boostCostRatio,
        boostCostResource,
        modifierType,
        isAdvanced
    }: PotentialOptions): Potential {
        const computedEffectRatio = convertComputable(effectRatio);
        const computedXPReqRatio = convertComputable(xpReqRatio);
        const computedBaseBoostCost = convertComputable(baseBoostCost);
        const computedBoostCostRatio = convertComputable(boostCostRatio);
        const computedBoostCostResource = convertComputable(boostCostResource);

        const level = persistent<number>(0);
        const xp = persistent<number>(0);
        const xpRequired = computed(() =>
            Decimal.pow(unref(computedXPReqRatio), level.value).times(100)
        );

        const effect = modifierEffects[modifierType ?? "multiplicative"](
            computedEffectRatio,
            level
        );
        let modifier;
        if (modifierType === "exponential") {
            modifier = createExponentialModifier(() => ({
                exponent: effect,
                description: name + " potential",
                enabled: isAdvanced
                    ? advancedPotentialsMilestone.earned
                    : potentialsMilestone.earned
            }));
        } else if (modifierType === "additive") {
            modifier = createAdditiveModifier(() => ({
                addend: effect,
                description: name + " potential",
                enabled: isAdvanced
                    ? advancedPotentialsMilestone.earned
                    : potentialsMilestone.earned
            }));
        } else {
            modifier = createMultiplicativeModifier(() => ({
                multiplier: effect,
                description: name + " potential",
                enabled: isAdvanced
                    ? advancedPotentialsMilestone.earned
                    : potentialsMilestone.earned
            }));
        }

        const boosts = persistent<number>(0);
        const cost = computed(() =>
            Decimal.times(
                unref(computedBaseBoostCost),
                Decimal.pow(unref(computedBoostCostRatio), boosts.value)
            )
        );
        const canAfford = computed(() =>
            Decimal.gte(unwrapResource(computedBoostCostResource).value, cost.value)
        );
        const clickable = createClickable(() => ({
            display: jsx(() => (
                <>
                    x2 boost for
                    <br />
                    {formatWhole(cost.value)}
                    <br />
                    {unwrapResource(computedBoostCostResource).displayName}
                    {showNotif.value ? <Notif style="top: -15px" /> : null}
                </>
            )),
            canClick: canAfford,
            onClick() {
                const resource = unwrapResource(computedBoostCostResource);
                resource.value = Decimal.sub(resource.value, cost.value);
                boosts.value++;
            }
        }));
        addTooltip(clickable, {
            display: jsx(() => (
                <>
                    You have {displayResource(unwrapResource(computedBoostCostResource))}{" "}
                    {unwrapResource(computedBoostCostResource).displayName}
                </>
            ))
        });

        let levelNotif: ToastID | null = null;
        watch(level, () => {
            if (settings.active !== player.id) return;
            if (levelNotif != null) {
                toast.dismiss(levelNotif);
            }
            levelNotif = toast.info(
                <>
                    <h3>Potential increased!</h3>
                    <div>
                        {modifierSymbols[modifierType ?? "multiplicative"]}
                        {format(unref(computedEffectRatio), precision ?? 2)} {name}
                    </div>
                </>
            );
        });

        const showNotif = createDismissableNotify(clickable, canAfford);

        return {
            level,
            xp,
            xpRequired,
            effect,
            modifier,
            boosts,
            cost,
            clickable,
            showNotif,
            effectRatio: computedEffectRatio,
            xpReqRatio: computedXPReqRatio,
            baseBoostCost: computedBaseBoostCost,
            boostCostRatio: computedBoostCostRatio,
            boostCostResource: computedBoostCostResource,
            update(diff) {
                let newXP = Decimal.add(
                    xp.value,
                    Decimal.pow(2, boosts.value).times(potentialsSpeed.apply(diff))
                );
                while (Decimal.gte(newXP, xpRequired.value)) {
                    newXP = newXP.sub(xpRequired.value);
                    level.value++;
                }
                xp.value = newXP.toNumber();
            },
            display: jsx(() => (
                <div class="potential feature dontMerge">
                    {render(clickable)}
                    <div class="potential-details">
                        Lv {formatWhole(level.value)} {name} (
                        {modifierSymbols[modifierType ?? "multiplicative"]}
                        {format(unref(computedEffectRatio), precision ?? 2)} each)
                    </div>
                    <div class="potential-xp">
                        <div
                            class="potential-xp-fill"
                            style={{
                                width: `${Decimal.div(xp.value, xpRequired.value)
                                    .times(100)
                                    .toNumber()}%`
                            }}
                        />
                    </div>
                </div>
            ))
        };
    }

    const grindingSpeedPotential = createPotential({
        name: "Grinding duration",
        effectRatio: 0.9,
        precision: 1,
        xpReqRatio: 1.3,
        baseBoostCost: 100,
        boostCostRatio: 2,
        boostCostResource: potentia
    });
    const potentiaGainPotential = createPotential({
        name: "Potentia gain",
        effectRatio: 1.05,
        xpReqRatio: 1.08,
        baseBoostCost: 100,
        boostCostRatio: 10,
        boostCostResource: potentia
    });
    const fallSpeedPotential = createPotential({
        name: "Grains fall speed",
        effectRatio: 1.025,
        precision: 3,
        xpReqRatio: 1.1,
        baseBoostCost: 100,
        boostCostRatio: 4,
        boostCostResource: potentia
    });
    const basicPotentials = { grindingSpeedPotential, potentiaGainPotential, fallSpeedPotential };

    const potentialsSpeedPotential = createPotential({
        name: "Potentials speed",
        effectRatio: 1.1,
        precision: 1,
        xpReqRatio: 1.5,
        baseBoostCost: 10000,
        boostCostRatio: 10,
        boostCostResource: potentia,
        isAdvanced: true
    });
    const effectiveGrainsPotential = createPotential({
        name: "Bonus grains",
        effectRatio: 1.05,
        xpReqRatio: 2,
        baseBoostCost: 100,
        boostCostRatio: 1.25,
        boostCostResource: () => {
            return Object.values(distill.elements)[effectiveGrainsPotential.boosts.value % 4]
                .resource;
        },
        isAdvanced: true
    });
    const jobXPPotential = createPotential({
        name: "Job EXP gain",
        effectRatio: 1.1,
        precision: 1,
        xpReqRatio: 1.25,
        baseBoostCost: 1e6,
        boostCostRatio: 8,
        boostCostResource: flowers.flowers,
        isAdvanced: true
    });
    const passiveGrindingPotential = createPotential({
        name: "Passive grinding",
        effectRatio: 1,
        precision: 0,
        xpReqRatio: 1.2,
        baseBoostCost: 1000,
        boostCostRatio: 5,
        boostCostResource: study.insights,
        modifierType: "additive",
        isAdvanced: true
    });
    const advancedPotentials = {
        potentialsSpeedPotential,
        effectiveGrainsPotential,
        jobXPPotential,
        passiveGrindingPotential
    };

    const jobLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, job.level.value)
    );
    const grainSizeLevel = computed(() => new Decimal(baseTotalGrains.value).log2().floor());
    const appliedTimeEffect = computed(() => Decimal.pow(1.1, job.level.value));

    const timePassing = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: appliedTimeEffect,
            description: "Applied time",
            enabled: () =>
                job.active.value && appliedTimeMilestone.earned.value && selectedJob.value === id
        })),
        generators.batteries.experiments.timePassing.modifier
    ]) as WithRequired<Modifier, "invert" | "enabled" | "description">;
    const computedTimePassing = computed(() => timePassing.apply(1));

    const jobXpGain = createSequentialModifier(() => [
        jobXPPotential.modifier,
        generators.batteries.experiments.xpGain.modifier
    ]) as WithRequired<Modifier, "invert" | "enabled" | "description">;

    const totalGrains = createSequentialModifier(() => [effectiveGrainsPotential.modifier]);
    const computedTotalGrains = computed(() => totalGrains.apply(baseTotalGrains.value));

    const grainsFallRate = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.1, grainSizeLevel.value),
            description: "Grain size (x1.1 each split)",
            enabled: chippingMilestone.earned
        })),
        fallSpeedPotential.modifier
    ]);
    const computedGrainsFallRate = computed(() => grainsFallRate.apply(1));

    const chippingDuration = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(2, grainSizeLevel.value),
            description: "Grain size (x2 each split)"
        })),
        grindingSpeedPotential.modifier
    ]);
    const computedChippingDuration = computed(() => chippingDuration.apply(1));

    const passiveGrinding = createSequentialModifier(() => [passiveGrindingPotential.modifier]);
    const computedPassiveGrinding = computed(() => passiveGrinding.apply(0));

    const potentiaGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: jobLevelEffect,
            description: `${job.name} level (x1.1 each)`
        })),
        potentiaGainPotential.modifier,
        generators.batteries.experiments.resourceGain.modifier,
        breeding.plants.potentia.modifier
    ]) as WithRequired<Modifier, "invert" | "enabled" | "description">;

    const potentialsSpeed = createSequentialModifier(() => [potentialsSpeedPotential.modifier]);

    const modifiers = {
        timePassing,
        jobXpGain,
        totalGrains,
        grainsFallRate,
        chippingDuration,
        potentiaGain,
        potentialsSpeed,
        passiveGrinding
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Time Passing",
            modifier: timePassing,
            base: 1,
            visible: () =>
                appliedTimeMilestone.earned.value ||
                generators.milestones.timeBatteriesMilestone.earned.value
        },
        {
            title: `${job.name} EXP Gain`,
            modifier: jobXpGain,
            base: 1
        },
        {
            title: "Potentia Gain",
            modifier: potentiaGain,
            base: 1
        },
        {
            title: "Potentials speed",
            modifier: potentialsSpeed,
            base: 1,
            visible: advancedPotentialsMilestone.earned
        }
    ]);

    const [grainsTab, grainsTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Total Grains",
            modifier: totalGrains,
            base: baseTotalGrains
        },
        {
            title: "Grains Fall Speed",
            modifier: grainsFallRate,
            base: 1,
            unit: "/s"
        },
        {
            title: "Grinding duration",
            modifier: chippingDuration,
            base: 1,
            unit: "s",
            visible: chippingMilestone.earned
        },
        {
            title: "Passive grinding",
            modifier: passiveGrinding,
            base: 0,
            unit: "%",
            visible: advancedPotentialsMilestone.earned
        }
    ]);
    const modifierTabs = createTabFamily(
        {
            general: () => ({
                display: "General",
                glowColor(): string {
                    return modifierTabs.activeTab.value === this.tab ? color : "";
                },
                tab: generalTab,
                generalTabCollapsed
            }),
            grains: () => ({
                display: "Grains",
                glowColor(): string {
                    return modifierTabs.activeTab.value === this.tab ? color : "";
                },
                tab: grainsTab,
                grainsTabCollapsed
            })
        },
        () => ({
            style: `--layer-color: ${color}`
        })
    );

    const grindingClickable = createClickable(() => ({
        display: {
            title: "Grind",
            description: "Hover to grind grains apart, to create new grains"
        }
    }));
    const isGrinding = trackHover(grindingClickable);

    this.on("preUpdate", diff => {
        if (!job.active.value) return;

        diff = Decimal.times(diff, computedTimePassing.value).toNumber();

        if (potentialsMilestone.earned.value) {
            Object.values(basicPotentials).forEach(p => p.update(diff));
        }

        if (advancedPotentialsMilestone.earned.value) {
            Object.values(advancedPotentials).forEach(p => p.update(diff));

            chippingProgress.value = Decimal.add(
                chippingProgress.value,
                Decimal.times(diff, computedPassiveGrinding.value).div(100)
            ).toNumber();
        }

        if (Decimal.lt(flippingProgress.value, 1)) {
            flippingProgress.value = Decimal.add(flippingProgress.value, diff).min(1).toNumber();
        } else if (Decimal.lt(grainsFallen.value, computedTotalGrains.value)) {
            const newGrainsFallen = Decimal.add(
                grainsFallen.value,
                Decimal.times(computedGrainsFallRate.value, diff)
            ).min(computedTotalGrains.value);
            const currPotentiaGain = potentiaGain.apply(
                Decimal.sub(newGrainsFallen, grainsFallen.value)
            );
            potentia.value = Decimal.add(potentia.value, currPotentiaGain);
            job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(currPotentiaGain));
            grainsFallen.value = newGrainsFallen;
        }

        if (isGrinding.value) {
            chippingProgress.value = chippingProgress.value + diff;
        }

        while (Decimal.gt(chippingProgress.value, computedChippingDuration.value)) {
            const grainsGain = Decimal.div(chippingProgress.value, computedChippingDuration.value)
                .floor()
                .min(
                    new Decimal(2)
                        .pow(new Decimal(baseTotalGrains.value).add(1).log2().floor().add(1))
                        .sub(baseTotalGrains.value)
                );
            chippingProgress.value =
                chippingProgress.value -
                grainsGain.times(computedChippingDuration.value).toNumber();
            baseTotalGrains.value = Decimal.add(baseTotalGrains.value, grainsGain);
        }
    });

    const tabs = createTabFamily(
        {
            grains: () => ({
                display: "Grains",
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <Spacer />
                            <Grains
                                baseGrains={baseTotalGrains.value}
                                chippingProgress={Decimal.div(
                                    chippingProgress.value,
                                    computedChippingDuration.value
                                ).toNumber()}
                            />
                            <Spacer />
                            {render(grindingClickable)}
                        </>
                    ))
                })),
                style: {
                    borderLeft: "5px solid var(--outline)",
                    marginLeft: "5px"
                }
            }),
            potentials: () => ({
                display: jsx(() => (
                    <span style="position: relative;">
                        Potentials
                        {potentialsNotif.value ? <Notif style="left: -15px; top: -10px" /> : null}
                    </span>
                )),
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <Spacer />
                            <h2>Basic Potentials</h2>
                            <Spacer />
                            {renderCol(...Object.values(basicPotentials).map(p => p.display))}
                            {advancedPotentialsMilestone.earned.value ? (
                                <>
                                    <Spacer />
                                    <h2>Advanced Potentials</h2>
                                    <Spacer />
                                    {renderCol(
                                        ...Object.values(advancedPotentials).map(p => p.display)
                                    )}
                                </>
                            ) : null}
                        </>
                    ))
                })),
                visibility: potentialsMilestone.earned
            }),
            appliedTime: () => ({
                display: "Applied Time",
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <Spacer />
                            <div>
                                Focus your potential towards speeding up an entire job's time loop.
                                <br />
                                Strength increases with {job.name} level.
                            </div>
                            <Spacer />
                            <AppliedTimeSelectors
                                effect={appliedTimeEffect.value}
                                jobs={main.jobs}
                                selectedJob={selectedJob.value}
                                onSelectJob={job => (selectedJob.value = job as JobKeys)}
                            />
                        </>
                    ))
                })),
                visibility: appliedTimeMilestone.earned
            })
        },
        () => ({
            classes: {
                floating: false
            },
            style: {
                borderStyle: "none",
                marginLeft: "-20px",
                marginRight: "-20px"
            },
            buttonContainerStyle: {
                top: "50px"
            }
        })
    );

    const hourglass = {
        [Component]: Hourglass as GenericComponent,
        [GatherProps]: () => ({
            totalGrains: computedTotalGrains.value,
            grainsFallen: grainsFallen.value,
            flippingProgress: flippingProgress.value,
            onFlip: () => {
                flippingProgress.value = flippingProgress.value >= 1 ? 0 : flippingProgress.value;
                grainsFallen.value = 0;
            },
            showHourglassNotif: showHourglassNotif.value
        })
    };
    const showHourglassNotif = createDismissableNotify(hourglass, () =>
        Decimal.sub(computedTotalGrains.value, grainsFallen.value).lte(0)
    );

    // TODO add particle effects to hourglass sands falling, and grains being ground
    return {
        name,
        color,
        minWidth: 670,
        potentia,
        baseTotalGrains,
        grainsFallen,
        flippingProgress,
        chippingProgress,
        basicPotentials,
        advancedPotentials,
        job,
        selectedJob,
        modifiers,
        milestones,
        collapseMilestones,
        modifierTabs,
        tabs,
        appliedTimeEffect,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstFeature.value) {
                milestonesToDisplay.push(firstFeature.value);
            }
            return (
                <>
                    <MainDisplay resource={potentia} color={color} />
                    {renderColJSX(
                        ...milestonesToDisplay,
                        jsx(() => (
                            <Collapsible
                                collapsed={collapseMilestones}
                                content={collapsedContent}
                                display={
                                    collapseMilestones.value
                                        ? "Show other completed milestones"
                                        : "Hide other completed milestones"
                                }
                                v-show={unref(hasCollapsedContent)}
                            />
                        ))
                    )}
                    <Spacer />
                    {render(hourglass)}
                    <Spacer height="50px" />
                    {chippingMilestone.earned.value ? render(tabs) : null}
                </>
            );
        })
    };
});

export default layer;
