/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Row from "components/layout/Row.vue";
import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleModifierSections } from "data/common";
import experiments from "data/experiments/experiments";
import { jobKeys, JobKeys, main } from "data/projEntry";
import {
    Component,
    GatherProps,
    GenericComponent,
    jsx,
    showIf,
    Visibility
} from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createTab } from "features/tabs/tab";
import { createTabFamily, TabButtonOptions } from "features/tabs/tabFamily";
import { addLayer, BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { Persistent, persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource } from "util/bignum";
import type { WithRequired } from "util/common";
import { camelToTitle } from "util/common";
import { Computable, convertComputable, ProcessedComputable } from "util/computed";
import { createLazyProxy } from "util/proxies";
import {
    getFirstFeature,
    joinJSX,
    render,
    renderColJSX,
    renderJSX,
    renderRow,
    VueFeature
} from "util/vue";
import { computed, ComputedRef, Ref, unref } from "vue";
import breeding from "../breeding/breeding";
import globalQuips from "../quips.json";
import rituals from "../rituals/rituals";
import Atom from "./Atom.vue";
import Battery from "./Battery.vue";
import alwaysQuips from "./quips.json";

export type BatteryType = "timePassing" | "resourceGain" | "xpGain";

export interface Battery extends VueFeature {
    charge: Persistent<DecimalSource>;
    chargeGain: WithRequired<Modifier, "revert" | "description">;
    computedChargeGain: Ref<DecimalSource>;
    color: ProcessedComputable<string>;
    feedAmount: Persistent<number>;
    effect: Ref<DecimalSource>;
    effectDescription: string;
    modifier: WithRequired<Modifier, "revert" | "description" | "enabled">;
    visibility: ProcessedComputable<Visibility>;
    setFeedAmount: (value: number) => void;
}

export type Batteries = Record<
    JobKeys,
    {
        job: JobKeys;
    } & Record<BatteryType, Battery>
>;

const id = "generators";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Harnessing Power";
    const color = "#26D1CE";

    const energeia = createResource<DecimalSource>(0, "energeia");
    const extraTimeSlotsAllocated = persistent<number>(0);

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "75%",
            y: "60%"
        },
        symbol: "⚛",
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: energeia,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        visibility: () => showIf(experiments.milestones.jobMilestone.earned.value)
    }));

    const multiLoopMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: `Achieve ${job.name} Level 2`,
            effectDisplay: "Unlock multiple generators"
        }
    }));
    const resourceBatteriesMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: `Achieve ${job.name} Level 4`,
            effectDisplay: "Unlock resource gain batteries"
        },
        visibility() {
            return showIf(multiLoopMilestone.earned.value);
        }
    }));
    const timeSlotMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 5);
        },
        display: {
            requirement: `Achieve ${job.name} Level 5`,
            effectDisplay: "Unlock ??? in ??? job"
        },
        visibility() {
            return showIf(resourceBatteriesMilestone.earned.value);
        }
    }));
    const xpBatteriesMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 6);
        },
        display: {
            requirement: `Achieve ${job.name} Level 6`,
            effectDisplay: "Unlock xp gain batteries"
        },
        visibility() {
            return showIf(timeSlotMilestone.earned.value);
        }
    }));
    const timeBatteriesMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 8);
        },
        display: {
            requirement: `Achieve ${job.name} Level 8`,
            effectDisplay: "Unlock time passing batteries"
        },
        visibility() {
            return showIf(xpBatteriesMilestone.earned.value);
        }
    }));
    const jobMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 10);
        },
        display: {
            requirement: `Achieve ${job.name} Level 10`,
            effectDisplay: `Unlock 1/2 of "${rituals.job.name}" Job`
        },
        visibility() {
            return showIf(timeBatteriesMilestone.earned.value);
        },
        onComplete() {
            if (breeding.milestones.jobMilestone.earned.value) {
                addLayer(rituals, player);
            }
        }
    })) as GenericMilestone;
    const milestones = {
        multiLoopMilestone,
        resourceBatteriesMilestone,
        timeSlotMilestone,
        xpBatteriesMilestone,
        timeBatteriesMilestone,
        jobMilestone
    };
    const orderedMilestones = [
        jobMilestone,
        timeBatteriesMilestone,
        xpBatteriesMilestone,
        timeSlotMilestone,
        resourceBatteriesMilestone,
        multiLoopMilestone
    ];
    const collapseMilestones = persistent<boolean>(true);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature, collapsedContent, hasCollapsedContent } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    function createBattery(
        optionsFunc: () => {
            job: JobKeys;
            visibility?: Computable<Visibility>;
            effectDescription: string;
            effectFormula: (charge: DecimalSource) => DecimalSource;
        }
    ): Battery {
        const charge = persistent<DecimalSource>(0);
        const feedAmount = persistent<number>(0);

        return createLazyProxy(() => {
            const battery = optionsFunc();

            const computedColor = computed(() => unref(main.jobs[battery.job].color));
            const computedVisibility = battery.visibility
                ? convertComputable(battery.visibility)
                : Visibility.Visible;
            const computedEffect = computed(() => battery.effectFormula(charge.value));

            const chargeGain = createSequentialModifier(() => [
                createAdditiveModifier(() => ({
                    addend: () => Decimal.times(energeia.value, feedAmount.value).div(100),
                    description: "Battery charging"
                })),
                createExponentialModifier(() => ({
                    exponent: () => Decimal.div(feedAmount.value, 500).add(1),
                    description: "Battery charging bonus",
                    supportLowNumbers: true
                })),
                createAdditiveModifier(() => ({
                    addend: () => Decimal.times(charge.value, 0.1).neg(),
                    description: "Battery discharge"
                }))
            ]);
            const computedChargeGain = computed(() => chargeGain.apply(0));

            const modifier = createMultiplicativeModifier(() => ({
                multiplier: computedEffect,
                description: camelToTitle(battery.effectDescription) + " battery",
                enabled: () => unref(computedVisibility) === Visibility.Visible
            }));

            return {
                charge,
                chargeGain,
                computedChargeGain,
                color: computedColor,
                feedAmount,
                effect: computedEffect,
                effectDescription: battery.effectDescription,
                modifier,
                visibility: computedVisibility,
                setFeedAmount: value => (feedAmount.value = value),
                [Component]: Battery as GenericComponent,
                [GatherProps]: function (this: Battery) {
                    const {
                        charge,
                        effect,
                        effectDescription,
                        feedAmount,
                        color,
                        visibility,
                        setFeedAmount
                    } = this;
                    return {
                        charge,
                        effect,
                        effectDescription,
                        feedAmount,
                        color,
                        visibility,
                        sumFeedAmounts,
                        setFeedAmount
                    };
                }
            };
        });
    }

    const batteries = jobKeys.reduce((acc, curr) => {
        acc[curr] = {
            job: curr,
            resourceGain: createBattery(() => ({
                job: curr,
                effectDescription: "resource gain",
                effectFormula: charge =>
                    Decimal.div(charge, curr === id ? 10 : 100)
                        .add(1)
                        .log(1.3)
                        .add(1)
                        .pow(1)
            })),
            xpGain: createBattery(() => ({
                job: curr,
                effectDescription: "xp gain",
                effectFormula: charge =>
                    Decimal.div(charge, curr === id ? 6 : 60)
                        .add(1)
                        .log(1.3)
                        .add(1),
                visibility: () => showIf(xpBatteriesMilestone.earned.value)
            })),
            timePassing: createBattery(() => ({
                job: curr,
                effectDescription: "time passing",
                effectFormula: charge =>
                    Decimal.div(charge, curr === id ? 10 : 100)
                        .add(1)
                        .log(10)
                        .add(1),
                visibility: () => showIf(resourceBatteriesMilestone.earned.value)
            }))
        };
        return acc;
    }, {} as Partial<Batteries>) as Batteries;

    const sumFeedAmounts = computed(() =>
        Object.values(batteries).reduce(
            (acc, curr) =>
                acc +
                curr.timePassing.feedAmount.value +
                curr.resourceGain.feedAmount.value +
                curr.xpGain.feedAmount.value,
            0
        )
    );

    const jobLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, job.level.value)
    );

    const timePassing = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: experiments.appliedTimeEffect,
            description: "Applied time",
            enabled: () =>
                experiments.job.active.value &&
                experiments.milestones.appliedTimeMilestone.earned.value &&
                experiments.selectedJob.value === id
        })),
        batteries.generators.timePassing.modifier
    ]) as WithRequired<Modifier, "revert" | "enabled" | "description">;
    const computedTimePassing = computed(() => new Decimal(timePassing.apply(1)).toNumber());

    const timeSlotsGenerating = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: extraTimeSlotsAllocated,
            description: "Allocated time slots"
        })),
        createAdditiveModifier(() => ({
            addend: 1,
            description: "Bonus generator",
            enabled: (): boolean =>
                breeding.job.active.value &&
                breeding.milestones.bonusGeneratorMilestone.earned.value
        }))
    ]);
    const computedTimeSlotsGenerating = computed(() => timeSlotsGenerating.apply(1));

    const energeiaGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: jobLevelEffect,
            description: `${job.name} level (x1.1 each)`
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(computedTimeSlotsGenerating.value, 2),
            description: "Allocated time slots",
            enabled: multiLoopMilestone.earned
        })),
        batteries.generators.resourceGain.modifier
    ]);

    const jobXpGain = createSequentialModifier(() => [batteries.generators.xpGain.modifier]);

    const modifiers = {
        timePassing,
        timeSlotsGenerating,
        energeiaGain,
        jobXpGain
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Time Passing",
            modifier: timePassing,
            base: 1,
            visible: () =>
                experiments.milestones.appliedTimeMilestone.earned.value ||
                timeBatteriesMilestone.earned.value
        },
        {
            title: "Generators",
            modifier: timeSlotsGenerating,
            base: 1
        },
        {
            title: "Energeia Gain",
            modifier: energeiaGain,
            base: 1
        },
        {
            title: `${job.name} EXP Gain`,
            modifier: jobXpGain,
            base: 1,
            baseText: "Base (per energeia gained)"
        }
    ]);
    const batteryCollapsibleModifierSections = ["resourceGain", "xpGain", "timePassing"].map(key =>
        createCollapsibleModifierSections(() =>
            Object.values(batteries).map(battery => ({
                title: camelToTitle(battery.job) + " Battery Charge Gain",
                modifier: battery[key as BatteryType].chargeGain,
                enabled: unref(battery[key as BatteryType].visibility) === Visibility.Visible,
                base: 0
            }))
        )
    );
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
            ...batteryCollapsibleModifierSections.reduce((acc, [tab, tabCollapsed], index) => {
                const key = ["timePassing", "resourceGain", "xpGain"][index] as BatteryType;
                acc[key] = () => ({
                    display: camelToTitle(key),
                    glowColor(): string {
                        return modifierTabs.activeTab.value === this.tab ? color : "";
                    },
                    tab,
                    tabCollapsed,
                    visibility: () =>
                        showIf(
                            [
                                timeBatteriesMilestone,
                                resourceBatteriesMilestone,
                                xpBatteriesMilestone
                            ][index].earned.value
                        )
                });
                return acc;
            }, {} as Partial<Record<BatteryType, () => TabButtonOptions>>)
        },
        () => ({
            style: `--layer-color: ${color}`
        })
    );

    this.on("preUpdate", diff => {
        if (job.timeLoopActive.value === false && player.tabs[1] !== id) return;

        diff = Decimal.times(diff, computedTimePassing.value).toNumber();

        let spentEnergeia = new Decimal(0);
        Object.values(batteries).forEach(batteryCategory => {
            Object.values(batteryCategory).forEach(battery => {
                // Ignore "job" property
                if (typeof battery === "string") {
                    return;
                }

                battery.charge.value = Decimal.add(
                    battery.charge.value,
                    Decimal.times(battery.computedChargeGain.value, diff)
                ).clampMin(0);

                spentEnergeia = spentEnergeia.add(battery.feedAmount.value);
            });
        });
        energeia.value = Decimal.sub(
            energeia.value,
            Decimal.div(spentEnergeia, 100).times(energeia.value)
        );

        const gain = Decimal.times(energeiaGain.apply(1), diff);
        energeia.value = Decimal.add(energeia.value, gain);
        job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(gain));
    });

    const tabs = createTabFamily(
        {
            generation: () => ({
                display: "Generation",
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <Atom speed={computedTimePassing.value} />
                            {multiLoopMilestone.earned.value ? (
                                <>
                                    <div>
                                        {main.hasTimeSlotAvailable.value
                                            ? "Click to allocate or deallocate additional time loops to this job"
                                            : "Free up time slots to allocate additional time loops to this job"}
                                    </div>
                                    <Row>
                                        {Array(
                                            main.hasTimeSlotAvailable.value
                                                ? new Decimal(
                                                      computedTimeSlotsGenerating.value
                                                  ).toNumber()
                                                : Decimal.sub(
                                                      computedTimeSlotsGenerating.value,
                                                      1
                                                  ).toNumber()
                                        )
                                            .fill(0)
                                            .map((_, i) => (
                                                <Atom
                                                    speed={computedTimePassing.value}
                                                    width="100px"
                                                    height="100px"
                                                    style={
                                                        Decimal.lt(
                                                            computedTimeSlotsGenerating.value,
                                                            i + 2
                                                        )
                                                            ? "opacity: 0.25"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        Decimal.lt(
                                                            computedTimeSlotsGenerating.value,
                                                            i + 2
                                                        )
                                                            ? extraTimeSlotsAllocated.value++
                                                            : extraTimeSlotsAllocated.value--
                                                    }
                                                />
                                            ))}
                                    </Row>
                                </>
                            ) : null}
                        </>
                    ))
                })),
                style: {
                    borderLeft: "5px solid var(--outline)",
                    marginLeft: "5px"
                }
            }),
            batteries: () => ({
                display: "Batteries",
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <Spacer />
                            <div>
                                Allocate a percentage of {energeia.displayName}/s to feed into each
                                battery.
                            </div>
                            <div>Batteries discharge over time.</div>
                            <Spacer />
                            {joinJSX(
                                Object.values(batteries)
                                    .filter(
                                        b =>
                                            unref(main.jobs[b.job].visibility) ===
                                            Visibility.Visible
                                    )
                                    .map(batteriesCategory => (
                                        <>
                                            <h2>{main.jobs[batteriesCategory.job].name}</h2>
                                            {renderRow(
                                                batteriesCategory.resourceGain,
                                                batteriesCategory.xpGain,
                                                batteriesCategory.timePassing
                                            )}
                                        </>
                                    )),
                                <Spacer height="50px" />
                            )}
                        </>
                    ))
                })),
                visibility: computed(() => showIf(timeBatteriesMilestone.earned.value))
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

    return {
        name,
        color,
        minWidth: 670,
        energeia,
        extraTimeSlotsAllocated,
        job,
        modifiers,
        milestones,
        collapseMilestones,
        batteries,
        modifierTabs,
        tabs,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstFeature.value) {
                milestonesToDisplay.push(firstFeature.value);
            }
            return (
                <>
                    <MainDisplay resource={energeia} color={color} />
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
                    {timeBatteriesMilestone.earned.value
                        ? render(tabs)
                        : /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
                          render(tabs.activeTab.value!)}
                </>
            );
        })
    };
});

export default layer;
