/**
 * @module
 * @hidden
 */

import { Emitter, EmitterConfigV3 } from "@pixi/particle-emitter";
import Slider from "components/fields/Slider.vue";
import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import Node from "components/Node.vue";
import Notif from "components/Notif.vue";
import { createCollapsibleModifierSections, Section } from "data/common";
import flowers from "data/flowers/flowers";
import { main } from "data/projEntry";
import { createBuyable, GenericBuyable } from "features/buyable";
import { jsx, JSXFunction, Visibility } from "features/feature";
import { createJob, GenericJob } from "features/job/job";
import { createAchievement, GenericAchievement } from "features/achievements/achievement";
import { createParticles } from "features/particles/particles";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, displayResource, Resource, trackBest } from "features/resources/resource";
import { createTabFamily } from "features/tabs/tabFamily";
import Tooltip from "features/tooltips/Tooltip.vue";
import { addLayer, BaseLayer, createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { createDismissableNotify } from "game/notifications";
import { Persistent, persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import { camelToTitle, WithRequired } from "util/common";
import { Computable, convertComputable, ProcessedComputable } from "util/computed";
import { getFirstFeature, render, renderColJSX, renderJSX, renderRowJSX } from "util/vue";
import { computed, ComputedRef, nextTick, Ref, ref, unref, watch } from "vue";
import experiments from "../experiments/experiments";
import globalQuips from "../quips.json";
import study from "../study/study";
import generators from "../generators/generators";
import "./distill.css";
import elementParticles from "./elementParticles.json";
import alwaysQuips from "./quips.json";
import breeding from "data/breeding/breeding";
import { createLazyProxy } from "util/proxies";
import { createBooleanRequirement } from "game/requirements";

export interface Element {
    name: string;
    symbol: string;
    color: string;
    resource: Resource;
    conversionAmount: Persistent<number>;
    cost: WithRequired<Modifier, "revert" | "description">;
    computedCost: Ref<DecimalSource>;
    gain: WithRequired<Modifier, "revert" | "description">;
    actualGain: Ref<DecimalSource>;
    tab: JSXFunction;
    tabCollapsed: Persistent<Record<number, boolean>>;
    display: JSXFunction;
    visible: ProcessedComputable<boolean>;
    principleClickable: GenericBuyable | null;
    showNotif: Ref<boolean> | null;
    particlesEmitter: Ref<Promise<Emitter>>;
    refreshParticleEffect: VoidFunction;
}

const isPastChapter1 = computed(() => main.chapter.value > 1);

function getElementParticlesConfig(startColor: string, endColor: string) {
    return Object.assign({}, elementParticles, {
        behaviors: [
            ...elementParticles.behaviors,
            {
                type: "color",
                config: {
                    color: {
                        list: [
                            {
                                time: 0,
                                value: startColor
                            },
                            {
                                time: 1,
                                value: endColor
                            }
                        ]
                    }
                }
            }
        ]
    });
}

const id = "distill";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Purifying Flowers";
    const color = "#267BD1";

    const essentia = createResource<DecimalSource>(0, "essentia");
    const bestEssentia = trackBest(essentia);

    const elementsNotif: ComputedRef<boolean> = computed(() =>
        Object.values(elements).some(e => unref(e.showNotif?.value))
    ) as ComputedRef<boolean>;

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "25%",
            y: "60%"
        },
        symbol: "🝭",
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: essentia,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        visibility: isPastChapter1,
        showNotif: elementsNotif
    })) as GenericJob;

    const waterMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 2)),
        display: {
            requirement: `Achieve ${job.name} Level 2`,
            effectDisplay: "Unlock Water"
        }
    }));
    const principlesMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 4)),
        display: {
            requirement: `Achieve ${job.name} Level 4`,
            effectDisplay: "Unlock Principles"
        },
        visibility: waterMilestone.earned
    }));
    const studyMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 5)),
        display: {
            requirement: `Achieve ${job.name} Level 5`,
            effectDisplay: `Unlock "${study.job.name}" Job`
        },
        visibility: principlesMilestone.earned,
        onComplete() {
            addLayer(study, player);
        }
    })) as GenericAchievement;
    const airMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 6)),
        display: {
            requirement: `Achieve ${job.name} Level 6`,
            effectDisplay: "Unlock Air"
        },
        visibility: studyMilestone.earned
    }));
    const fireMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 8)),
        display: {
            requirement: `Achieve ${job.name} Level 8`,
            effectDisplay: "Unlock Fire"
        },
        visibility: airMilestone.earned
    }));
    const experimentsMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 10)),
        display: {
            requirement: `Achieve ${job.name} Level 10`,
            effectDisplay: `Unlock "${experiments.job.name}" Job`
        },
        visibility: fireMilestone.earned,
        onComplete() {
            addLayer(experiments, player);
        }
    })) as GenericAchievement;
    const milestones = {
        waterMilestone,
        principlesMilestone,
        studyMilestone,
        airMilestone,
        fireMilestone,
        experimentsMilestone
    };
    const orderedMilestones = [
        experimentsMilestone,
        fireMilestone,
        airMilestone,
        studyMilestone,
        principlesMilestone,
        waterMilestone
    ];
    const collapseMilestones = persistent<boolean>(true);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature, collapsedContent, hasCollapsedContent } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    const particles = createParticles(() => ({
        fullscreen: false,
        zIndex: -1,
        boundingRect: ref<DOMRect | undefined>(undefined),
        onContainerResized(boundingRect) {
            this.boundingRect.value = boundingRect;
        },
        onHotReload() {
            Object.values(elements).forEach(element => element.refreshParticleEffect());
        }
    }));

    const jobLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, job.level.value)
    );

    function createElement(
        name: string,
        optionsFunc: () => {
            symbol: string;
            color: string;
            particlesConfig: EmitterConfigV3;
            modifiers: () => Modifier[];
            prevElement?: Element | null;
            visible?: Computable<boolean>;
        },
        principle = ""
    ): Element {
        const conversionAmount = persistent<number>(0);
        const resource = createResource<DecimalSource>(0, name + " essence", 2);
        let modifierSections: Section[] = [];
        const [tab, tabCollapsed] = createCollapsibleModifierSections(() => modifierSections);
        let principleClickable: GenericBuyable | null = null;
        let showNotif: Ref<boolean> | null = null;

        const passiveEssenceGain = createSequentialModifier(() => [
            createAdditiveModifier(() => ({
                addend: () => Decimal.times(principleClickable?.amount.value ?? 0, 5),
                description: jsx(() => (
                    <>
                        {camelToTitle(principle)} effect (5 x {principle} amount)
                    </>
                ))
            }))
        ]);

        if (principle) {
            principleClickable = createBuyable(() => ({
                display: jsx(() => (
                    <div>
                        Prepare {principle} to gain a portion of {name} whenever the above
                        instrument is active
                        {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
                        <br />({formatWhole(passiveEssenceGain.apply(0))}%)
                        <br />
                        <br />
                        {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
                        Cost: {displayResource(resource, unref(principleClickable!.cost))}{" "}
                        {resource.displayName}
                        {showNotif?.value ? <Notif style="top: -25px" /> : null}
                    </div>
                )),
                visibility: principlesMilestone.earned,
                resource,
                cost() {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    return Decimal.pow(10, principleClickable!.amount.value);
                }
            }));
            showNotif = createDismissableNotify(principleClickable, principleClickable.canAfford);
        }

        return createLazyProxy(() => {
            const element = Object.assign(
                { principle: "", prevElement: null, visible: true },
                optionsFunc()
            ) as {
                symbol: string;
                color: string;
                particlesConfig: EmitterConfigV3;
                modifiers: () => Modifier[];
                prevElement: Element | null;
                visible: Computable<boolean>;
            };

            const processedVisible = convertComputable(element.visible);
            const cost = createSequentialModifier(() => []);
            const computedCost = computed(() =>
                cost.apply(
                    Decimal.times(flowers.flowers.value, conversionAmount.value).div(100).floor()
                )
            );
            const gain = createSequentialModifier(() => [
                createMultiplicativeModifier(() => ({
                    multiplier: () => Decimal.div(conversionAmount.value, 100)
                })),
                createMultiplicativeModifier(() => ({
                    multiplier: jobLevelEffect,
                    description: `${job.name} level (x1.1 each)`
                })),
                generators.batteries.distill.resourceGain.modifier,
                ...element.modifiers()
            ]) as WithRequired<Modifier, "revert" | "enabled" | "description">;
            const actualGain = computed(() =>
                Decimal.add(
                    gain.apply(
                        Decimal.gt(computedCost.value, 0)
                            ? Decimal.div(computedCost.value, 100).ceil().log(10)
                            : 0
                    ),
                    Decimal.times(
                        element.prevElement?.actualGain.value ?? 0,
                        passiveEssenceGain.apply(0)
                    ).div(100)
                )
            );
            modifierSections = [
                {
                    title: "Flowers Loss",
                    modifier: cost,
                    base: () =>
                        Decimal.times(flowers.flowers.value, conversionAmount.value)
                            .div(100)
                            .floor(),
                    baseText: jsx(() => <>Base (⌊flowers x conversion amount⌋)</>),
                    unit: "/sec"
                },
                {
                    title: `${camelToTitle(name)} Essence Gain`,
                    subtitle: "When cost is non-zero",
                    modifier: gain,
                    base: () =>
                        Decimal.gt(computedCost.value, 0)
                            ? Decimal.div(computedCost.value, 100).ceil().log(10)
                            : 0,
                    baseText: jsx(() => (
                        <>
                            Base (log<sub>10</sub>(flowers loss))
                        </>
                    )),
                    unit: "/sec"
                }
            ];
            if (principleClickable && element.prevElement) {
                modifierSections.push({
                    title: `${camelToTitle(name)} Essence Gain`,
                    subtitle: `% of ${camelToTitle(element.prevElement.name)} essence gain`,
                    modifier: passiveEssenceGain,
                    base: 0,
                    unit: "%"
                });
            }

            const display = jsx(() =>
                unref(processedVisible) ? (
                    <div class="element-display" style={"color: " + element.color}>
                        <Tooltip display={camelToTitle(name)}>
                            <div class="element-logo">
                                {element.symbol}
                                <Node id={name} />
                            </div>
                        </Tooltip>
                        <div class="element-amount">{formatWhole(resource.value)}</div>
                    </div>
                ) : (
                    ""
                )
            );
            const particlesEmitter = ref(particles.addEmitter(element.particlesConfig));
            const updateParticleEffect = async ([isGaining, rect, boundingRect]: [
                boolean,
                DOMRect | undefined,
                DOMRect | undefined
            ]) => {
                const particle = await particlesEmitter.value;
                particle.emit = isGaining && rect != undefined && boundingRect != undefined;
                if (isGaining && rect && boundingRect && !particle.destroyed) {
                    particle.cleanup();
                    particle.updateOwnerPos(
                        rect.x + rect.width / 2 - boundingRect.x,
                        rect.y + rect.height / 2 - boundingRect.y
                    );
                    particle.resetPositionTracking();
                }
            };
            const refreshParticleEffect = () => {
                particlesEmitter.value
                    .then(e => e.destroy())
                    .then(
                        () =>
                            (particlesEmitter.value = particles.addEmitter(element.particlesConfig))
                    )
                    .then(() =>
                        updateParticleEffect([
                            Decimal.gt(actualGain.value, 0),
                            layer.nodes.value[name]?.rect,
                            particles.boundingRect.value
                        ])
                    );
            };

            nextTick(() =>
                watch(
                    [
                        () => Decimal.gt(actualGain.value, 0),

                        () => layer.nodes.value[name]?.rect,
                        particles.boundingRect
                    ],
                    updateParticleEffect
                )
            );

            return {
                name,
                ...element,
                resource,
                conversionAmount,
                cost,
                computedCost,
                gain,
                actualGain,
                tab,
                tabCollapsed,
                display,
                showNotif,
                visible: processedVisible,
                principleClickable,
                particlesEmitter,
                refreshParticleEffect
            };
        });
    }

    const earth = createElement("earth", () => ({
        symbol: "🜃",
        color: "green",
        particlesConfig: getElementParticlesConfig("#B6FF0D", "#59E80C"),
        modifiers: () => [breeding.plants.earthEssence.modifier]
    }));
    const water = createElement(
        "water",
        () => ({
            symbol: "🜄",
            color: "blue",
            particlesConfig: getElementParticlesConfig("#0D8CFF", "#0C46E8"),
            modifiers: () => [breeding.plants.waterEssence.modifier],
            prevElement: earth,
            visible: waterMilestone.earned
        }),
        "salt"
    );
    const air = createElement(
        "air",
        () => ({
            symbol: "🜁",
            color: "yellow",
            particlesConfig: getElementParticlesConfig("#FFCE0D", "#E8D20C"),
            modifiers: () => [breeding.plants.airEssence.modifier],
            prevElement: water,
            visible: airMilestone.earned
        }),
        "mercury"
    );
    const fire = createElement(
        "fire",
        () => ({
            symbol: "🜂",
            color: "red",
            particlesConfig: getElementParticlesConfig("#FF530D", "#E82C0C"),
            modifiers: () => [breeding.plants.fireEssence.modifier],
            prevElement: air,
            visible: fireMilestone.earned
        }),
        "sulfur"
    );
    const elements = { earth, water, air, fire };

    function createInstrument(element: Element, name: string, symbol: string) {
        const display = jsx(() =>
            unref(element.visible) ? (
                <div>
                    <div
                        class={{
                            instrument: true,
                            principled:
                                element.principleClickable &&
                                unref(element.principleClickable.visibility) == Visibility.Visible
                        }}
                        style={`--progress: ${
                            element.conversionAmount.value / 100
                        }; --foreground: ${element.color}`}
                    >
                        <div style="width: 100%; display: flex">
                            <span class="instrument-logo">{symbol}</span>
                            <span class="instrument-details">
                                <div>{camelToTitle(name)}</div>
                                <div>
                                    -{displayResource(flowers.flowers, element.computedCost.value)}{" "}
                                    {flowers.flowers.displayName}/sec
                                </div>
                                <div>
                                    +{displayResource(element.resource, element.actualGain.value)}{" "}
                                    {element.resource.displayName}/sec
                                </div>
                                <Slider
                                    max={Object.values(instruments)
                                        .filter(i => i.name !== name)
                                        .reduce(
                                            (acc, curr) =>
                                                acc - curr.element.conversionAmount.value,
                                            100
                                        )}
                                    modelValue={element.conversionAmount.value}
                                    onUpdate:modelValue={v => (element.conversionAmount.value = v)}
                                />
                            </span>
                        </div>
                    </div>
                    {element.principleClickable ? renderJSX(element.principleClickable) : null}
                </div>
            ) : (
                ""
            )
        );

        return {
            name,
            symbol,
            element,
            display
        };
    }

    const alembic = createInstrument(earth, "alembic", "🝪");
    const retort = createInstrument(water, "retort", "🝭");
    const crucible = createInstrument(air, "crucible", "🝧");
    const bainMarie = createInstrument(fire, "bainMarie", "🝫");
    const instruments = { retort, alembic, crucible, bainMarie };

    const timePassing = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: experiments.appliedTimeEffect,
            description: "Applied time",
            enabled: () =>
                experiments.job.active.value &&
                experiments.milestones.appliedTimeMilestone.earned.value &&
                experiments.selectedJob.value === id
        })),
        generators.batteries.distill.timePassing.modifier
    ]) as WithRequired<Modifier, "revert" | "enabled" | "description">;
    const computedTimePassing = computed(() => timePassing.apply(1));

    const jobXp = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.max(1, earth.resource.value),
            description: "Earth Essence"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.max(1, water.resource.value),
            description: "Water Essence"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.max(1, air.resource.value),
            description: "Air Essence"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.max(1, fire.resource.value),
            description: "Fire Essence"
        })),
        generators.batteries.distill.xpGain.modifier
    ]) as WithRequired<Modifier, "revert" | "enabled" | "description">;

    const totalFlowerLoss = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: earth.computedCost,
            description: "Alembic"
        })),
        createAdditiveModifier(() => ({
            addend: water.computedCost,
            description: "Retort"
        })),
        createAdditiveModifier(() => ({
            addend: air.computedCost,
            description: "Crucible"
        })),
        createAdditiveModifier(() => ({
            addend: fire.computedCost,
            description: "Bain-Marie"
        }))
    ]);

    const modifiers = {
        timePassing,
        jobXp,
        totalFlowerLoss
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Time Passing",
            modifier: timePassing,
            base: 1,
            visible: () =>
                experiments.milestones.appliedTimeMilestone.earned.value ||
                generators.milestones.timeBatteriesMilestone.earned.value
        },
        {
            title: "Essentia",
            subtitle: `Also ${job.name} EXP Amount`,
            modifier: jobXp,
            base: 1
        },
        {
            title: "Flowers Loss",
            modifier: totalFlowerLoss,
            base: 0,
            unit: "/sec"
        }
    ]);
    const modifierTabs = createTabFamily({
        general: () => ({
            display: "General",
            glowColor(): string {
                return modifierTabs.activeTab.value === this.tab ? color : "";
            },
            tab: generalTab,
            generalTabCollapsed
        }),
        ...Object.entries(elements).reduce((acc, [id, element]) => {
            return {
                ...acc,
                [id]: () => ({
                    display: camelToTitle(element.name),
                    glowColor(): string {
                        return modifierTabs.activeTab.value === this.tab ? color : "";
                    },
                    tab: element.tab,
                    tabCollapsed: element.tabCollapsed
                })
            };
        }, {})
    });

    this.on("preUpdate", diff => {
        essentia.value = Object.values(elements).reduce(
            (acc, curr) => acc.times(Decimal.max(1, curr.resource.value)),
            new Decimal(1)
        );
        if (Decimal.gt(essentia.value, job.xp.value)) {
            job.xp.value = essentia.value;
        }

        if (!job.active.value) return;

        diff = Decimal.times(diff, computedTimePassing.value).toNumber();

        const spentFlowers = totalFlowerLoss.apply(0);
        Object.values(elements).forEach(element => {
            element.resource.value = Decimal.add(
                element.resource.value,
                Decimal.times(element.actualGain.value, diff)
            );
        });
        flowers.flowers.value = Decimal.sub(flowers.flowers.value, spentFlowers).max(0);
    });

    return {
        name,
        color,
        minWidth: 670,
        essentia,
        bestEssentia,
        elements,
        instruments,
        job,
        milestones,
        modifiers,
        modifierTabs,
        collapseMilestones,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstFeature.value) {
                milestonesToDisplay.push(firstFeature.value);
            }
            return (
                <>
                    <MainDisplay resource={essentia} color={color} />
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
                    {renderRowJSX(earth.display, water.display, air.display, fire.display)}
                    <Spacer />
                    {renderRowJSX(
                        alembic.display,
                        retort.display,
                        crucible.display,
                        bainMarie.display
                    )}
                    {render(particles)}
                </>
            );
        })
    };
});

export default layer;
