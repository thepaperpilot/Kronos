/**
 * @module
 * @hidden
 */

import { Emitter, EmitterConfigV3 } from "@pixi/particle-emitter";
import Slider from "components/fields/Slider.vue";
import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import Node from "components/Node.vue";
import { createCollapsibleModifierSections, Section } from "data/common";
import flowers from "data/flowers/flowers";
import { main } from "data/projEntry";
import { createBuyable, GenericBuyable } from "features/buyable";
import { jsx, JSXFunction, showIf, Visibility } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
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
import "./distill.css";
import elementParticles from "./elementParticles.json";
import alwaysQuips from "./quips.json";

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
    tabCollapsed: Persistent<boolean>[];
    display: JSXFunction;
    visible: ProcessedComputable<boolean>;
    principleClickable: GenericBuyable | null;
    particlesEmitter: Ref<Promise<Emitter>>;
    refreshParticleEffect: VoidFunction;
}

const isPastChapter1: ComputedRef<Visibility> = computed(() => showIf(main.chapter.value > 1));

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
    const color = "#8AFFC1";

    const essentia = createResource<DecimalSource>(0, "essentia");
    const bestEssentia = trackBest(essentia);

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "25%",
            y: "60%"
        },
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: essentia,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        visibility: isPastChapter1,
        showNotif: () => Object.values(elements).some(e => unref(e.principleClickable?.canClick))
    }));

    const waterMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: "Achieve Purifying Flowers Level 2",
            effectDisplay: "Unlock Water"
        }
    }));
    const principlesMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: "Achieve Purifying Flowers Level 4",
            effectDisplay: "Unlock Principles"
        },
        visibility() {
            return showIf(waterMilestone.earned.value);
        }
    }));
    const studyMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 5);
        },
        display: {
            requirement: "Achieve Purifying Flowers Level 5",
            effectDisplay: 'Unlock "Studying" Job'
        },
        visibility() {
            return showIf(principlesMilestone.earned.value);
        },
        onComplete() {
            addLayer(study, player);
        }
    }));
    const airMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 6);
        },
        display: {
            requirement: "Achieve Purifying Flowers Level 6",
            effectDisplay: "Unlock Air"
        },
        visibility() {
            return showIf(studyMilestone.earned.value);
        }
    }));
    const fireMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 8);
        },
        display: {
            requirement: "Achieve Purifying Flowers Level 8",
            effectDisplay: "Unlock Fire"
        },
        visibility() {
            return showIf(airMilestone.earned.value);
        }
    }));
    const experimentsMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 10);
        },
        display: {
            requirement: "Achieve Purifying Flowers Level 10",
            effectDisplay: `Unlock "Experimenting" Job`
        },
        visibility() {
            return showIf(fireMilestone.earned.value);
        },
        onComplete() {
            addLayer(experiments, player);
        }
    }));
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
        symbol: string,
        color: string,
        particlesConfig: EmitterConfigV3,
        principle = "",
        prevElement: Element | null = null,
        visible: Computable<boolean> = true
    ) {
        const processedVisible = convertComputable(visible);
        const resource = createResource<DecimalSource>(0, name + " essence", 2);
        const conversionAmount = persistent<number>(0);
        let principleClickable: GenericBuyable | null = null;
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
                    </div>
                )),
                visibility: () => showIf(principlesMilestone.earned.value),
                resource,
                cost() {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    return Decimal.pow(10, principleClickable!.amount.value);
                }
            }));
        }
        const cost = createSequentialModifier();
        const computedCost = computed(() =>
            cost.apply(
                Decimal.times(flowers.flowers.value, conversionAmount.value).div(100).floor()
            )
        );
        const gain = createSequentialModifier(
            createMultiplicativeModifier(() => Decimal.div(conversionAmount.value, 100)),
            createMultiplicativeModifier(jobLevelEffect, "Purifying Flowers level (x1.1 each)")
        );
        const passiveEssenceGain = createSequentialModifier(
            createAdditiveModifier(
                computed(() => Decimal.times(principleClickable?.amount.value ?? 0, 5)),
                jsx(() => (
                    <>
                        {camelToTitle(principle)} effect (5 x {principle} amount)
                    </>
                ))
            )
        );
        const actualGain = computed(() =>
            Decimal.add(
                gain.apply(
                    Decimal.gt(computedCost.value, 0)
                        ? Decimal.div(computedCost.value, 100).ceil().log(10)
                        : 0
                ),
                Decimal.times(prevElement?.actualGain.value ?? 0, passiveEssenceGain.apply(0)).div(
                    100
                )
            )
        );
        const modifierSections: Section[] = [
            {
                title: "Flowers Loss",
                modifier: cost,
                base: () =>
                    Decimal.times(flowers.flowers.value, conversionAmount.value).div(100).floor(),
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
        if (principleClickable && prevElement) {
            modifierSections.push({
                title: `${camelToTitle(name)} Essence Gain`,
                subtitle: `% of ${camelToTitle(prevElement.name)} essence gain`,
                modifier: passiveEssenceGain,
                base: 0,
                unit: "%"
            });
        }
        const [tab, tabCollapsed] = createCollapsibleModifierSections(modifierSections);

        const display = jsx(() =>
            unref(processedVisible) ? (
                <div class="element-display" style={"color: " + color}>
                    <Tooltip display={camelToTitle(name)}>
                        <div class="element-logo">
                            {symbol}
                            <Node id={name} />
                        </div>
                    </Tooltip>
                    <div class="element-amount">{formatWhole(resource.value)}</div>
                </div>
            ) : (
                ""
            )
        );
        const particlesEmitter = ref(particles.addEmitter(particlesConfig));
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
                .then(() => (particlesEmitter.value = particles.addEmitter(particlesConfig)))
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
            symbol,
            color,
            resource,
            conversionAmount,
            cost,
            computedCost,
            gain,
            actualGain,
            tab,
            tabCollapsed,
            display,
            visible: processedVisible,
            principleClickable,
            particlesEmitter,
            refreshParticleEffect
        };
    }

    const earth = createElement(
        "earth",
        "🜃",
        "green",
        getElementParticlesConfig("#B6FF0D", "#59E80C")
    );
    const water = createElement(
        "water",
        "🜄",
        "blue",
        getElementParticlesConfig("#0D8CFF", "#0C46E8"),
        "salt",
        earth,
        waterMilestone.earned
    );
    const air = createElement(
        "air",
        "🜁",
        "yellow",
        getElementParticlesConfig("#FFCE0D", "#E8D20C"),
        "mercury",
        water,
        airMilestone.earned
    );
    const fire = createElement(
        "fire",
        "🜂",
        "red",
        getElementParticlesConfig("#FF530D", "#E82C0C"),
        "sulfur",
        air,
        fireMilestone.earned
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

    const jobXp = createSequentialModifier(
        createMultiplicativeModifier(() => Decimal.max(1, earth.resource.value), "Earth Essence"),
        createMultiplicativeModifier(() => Decimal.max(1, water.resource.value), "Water Essence"),
        createMultiplicativeModifier(() => Decimal.max(1, air.resource.value), "Air Essence"),
        createMultiplicativeModifier(() => Decimal.max(1, fire.resource.value), "Fire Essence")
    );

    const totalFlowerLoss = createSequentialModifier(
        createAdditiveModifier(() => earth.computedCost.value, "Alembic"),
        createAdditiveModifier(() => water.computedCost.value, "Retort"),
        createAdditiveModifier(() => air.computedCost.value, "Crucible"),
        createAdditiveModifier(() => fire.computedCost.value, "Bain-Marie")
    );

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections([
        {
            title: "Essentia",
            subtitle: "Also Purifying Flowers EXP Amount",
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
        if (job.timeLoopActive.value === false && player.tabs[1] !== id) return;

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
