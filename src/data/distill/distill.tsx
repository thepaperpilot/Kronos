/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import Node from "components/Node.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { jsx, showIf, Visibility } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
import { createParticles } from "features/particles/particles";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createTabFamily } from "features/tabs/tabFamily";
import Tooltip from "features/tooltips/Tooltip.vue";
import { addLayer, BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import { getFirstFeature, render, renderColJSX, renderJSX, renderRowJSX } from "util/vue";
import { computed, ComputedRef, nextTick, ref, unref, watch } from "vue";
import experiments from "../experiments/experiments";
import globalQuips from "../quips.json";
import study from "../study/study";
import "./distill.css";
import alwaysQuips from "./quips.json";
import elementParticles from "./elementParticles.json";
import { camelToTitle } from "util/common";
import { EmitterConfigV3 } from "@pixi/particle-emitter";
import { Computable, convertComputable } from "util/computed";

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
    const name = "Distill Flowers";
    const color = "#8AFFC1";

    const essentia = createResource<DecimalSource>(0, "essentia");

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
        visibility: isPastChapter1
    }));

    const waterMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: "Achieve Distilling Flowers Level 2",
            effectDisplay: "Unlock Water"
        }
    }));
    const principlesMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: "Achieve Distilling Flowers Level 4",
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
            requirement: "Achieve Distilling Flowers Level 5",
            effectDisplay: 'Unlock "Study Flowers" Job'
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
            requirement: "Achieve Distilling Flowers Level 6",
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
            requirement: "Achieve Distilling Flowers Level 8",
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
            requirement: "Achieve Distilling Flowers Level 10",
            effectDisplay: `Unlock "Experiment" Job`
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
    const { firstFeature: firstMilestone, hiddenFeatures: otherMilestones } = getFirstFeature(
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

    function createElement(
        name: string,
        symbol: string,
        gain: ComputedRef<DecimalSource>,
        color: string,
        particlesConfig: EmitterConfigV3,
        visible: Computable<boolean> = true
    ) {
        const processedVisible = convertComputable(visible);
        const amount = createResource(0, name + " essence");
        const display = jsx(() =>
            unref(processedVisible) ? (
                <div class="element-display" style={"color: " + color}>
                    <Tooltip display={camelToTitle(name)}>
                        <div class="element-logo">
                            {symbol}
                            <Node id={name} />
                        </div>
                    </Tooltip>
                    <div class="element-amount">{formatWhole(amount.value)}</div>
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
            particle.emit = isGaining;
            if (isGaining && rect && boundingRect) {
                particle.cleanup();
                particle.updateOwnerPos(
                    rect.x + rect.width / 2 - boundingRect.x,
                    rect.y + rect.height / 2 - boundingRect.y
                );
                particle.resetPositionTracking();
            }
        };
        const refreshParticleEffect = () => {
            particlesEmitter.value.then(e => e.destroy());
            particlesEmitter.value = particles.addEmitter(particlesConfig);
            updateParticleEffect([
                Decimal.gt(gain.value, 0),
                layer.nodes.value[name]?.rect,
                particles.boundingRect.value
            ]);
        };

        nextTick(() =>
            watch(
                () =>
                    [
                        Decimal.gt(gain.value, 0),
                        layer.nodes.value[name]?.rect,
                        particles.boundingRect.value
                    ] as [boolean, DOMRect | undefined, DOMRect | undefined],
                updateParticleEffect,
                { immediate: true }
            )
        );

        return {
            amount,
            gain,
            display,
            particlesEmitter,
            refreshParticleEffect
        };
    }

    const earth = createElement(
        "earth",
        "🜃",
        computed(() => 1),
        "green",
        getElementParticlesConfig("#B6FF0D", "#59E80C")
    );
    const water = createElement(
        "water",
        "🜄",
        computed(() => 1),
        "blue",
        getElementParticlesConfig("#0D8CFF", "#0C46E8"),
        waterMilestone.earned
    );
    const air = createElement(
        "air",
        "🜁",
        computed(() => 1),
        "yellow",
        getElementParticlesConfig("#FFCE0D", "#E8D20C"),
        airMilestone.earned
    );
    const fire = createElement(
        "fire",
        "🜂",
        computed(() => 1),
        "red",
        getElementParticlesConfig("#FF530D", "#E82C0C"),
        fireMilestone.earned
    );
    const elements = { earth, water, air, fire };

    const jobLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, job.level.value)
    );

    const jobXpGain = createSequentialModifier(
        createMultiplicativeModifier(jobLevelEffect, "Distilling Flowers level (x1.1 each)")
    );

    const modifiers = {
        jobXpGain
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections([
        {
            title: "Distilling Flowers EXP Gain",
            modifier: jobXpGain,
            base: 0,
            unit: "/sec"
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
            })
        },
        () => ({
            style: `--layer-color: ${color}`
        })
    );

    this.on("preUpdate", diff => {
        if (job.timeLoopActive.value === false && player.tabs[1] !== id) return;

        job.xp.value = Decimal.add(job.xp.value, Decimal.times(jobXpGain.apply(0), diff));
    });

    return {
        name,
        color,
        minWidth: 670,
        essentia,
        earth,
        water,
        air,
        fire,
        job,
        modifiers,
        milestones,
        collapseMilestones,
        modifierTabs,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstMilestone.value) {
                milestonesToDisplay.push(firstMilestone.value);
            }
            return (
                <>
                    <MainDisplay resource={essentia} color={color} />
                    {renderColJSX(
                        ...milestonesToDisplay,
                        jsx(() => (
                            <Collapsible
                                collapsed={collapseMilestones}
                                content={jsx(() => renderColJSX(...otherMilestones.value))}
                                display={
                                    collapseMilestones.value
                                        ? "Show other completed milestones"
                                        : "Hide other completed milestones"
                                }
                                v-show={otherMilestones.value.length > 0}
                            />
                        ))
                    )}
                    {renderRowJSX(earth.display, water.display, air.display, fire.display)}
                    <Spacer />
                    {render(particles)}
                </>
            );
        })
    };
});

export default layer;
