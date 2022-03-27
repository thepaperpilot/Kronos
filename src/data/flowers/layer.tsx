/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { createClickable, GenericClickable } from "features/clickables/clickable";
import { jsx, showIf, Visibility } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource } from "util/bignum";
import { EmitterInstance } from "tsparticles-plugin-emitters/EmitterInstance";
import { formatWhole } from "util/break_eternity";
import { getFirstFeature, render, renderCol, renderRow } from "util/vue";
import { computed, ref, Ref, unref, watch, WatchStopHandle } from "vue";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
import { IParticlesOptions } from "tsparticles-engine";
import confetti from "../confetti.json";
import "./flowers.css";
import { createParticles } from "features/particles/particles";
import Collapsible from "components/layout/Collapsible.vue";

const layer = createLayer(function (this: BaseLayer) {
    const id = "flowers";
    const name = "Harvesting Flowers";
    const color = "#F1EBD9";

    const flowers = createResource<DecimalSource>(0, "flowers");

    const job = createJob(() => ({
        name,
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "75%",
            y: "30%"
        },
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: flowers,
        layerID: id
    }));

    const activeSpells = computed(
        () => Object.values(spellSelectors).filter(ss => ss.active.value).length
    );
    const maxActiveSpells = computed(() => 1);

    const particles = createParticles(() => ({
        fullscreen: false,
        boundingRect: ref<null | DOMRect>(null),
        onContainerResized(boundingRect) {
            this.boundingRect.value = boundingRect;
        }
    }));

    function createSpellSelector(
        title: string,
        description: string,
        effect: string
    ): GenericClickable & { active: Ref<boolean> } {
        const clickable = createClickable(() => ({
            canClick(): boolean {
                return this.active.value || activeSpells.value < maxActiveSpells.value;
            },
            display: {
                title: `<h2>${title}</h2>`,
                description: `<br/><i>${description}</i><br/><br/><h3>${effect}</h3>`
            },
            style: "width: 150px; height: 150px; z-index: 2",
            classes(): Record<string, boolean> {
                return {
                    spellSelector: true,
                    activeSpell: this.active.value
                };
            },
            onClick() {
                this.active.value = !this.active.value;
            },
            active: persistent<boolean>(false)
        }));

        const particleRef = ref<null | Promise<EmitterInstance>>(null);
        let watcher: WatchStopHandle | null = null;
        watch(clickable.active, async active => {
            if (particleRef.value) {
                // TODO why is this cast necessary?
                particles.removeEmitter((await particleRef.value) as EmitterInstance);
                watcher?.();
            }
            if (active) {
                watcher = watch(
                    [() => layer.nodes.value[clickable.id]?.rect, particles.boundingRect],
                    async ([rect, boundingRect]) => {
                        if (rect && boundingRect) {
                            if (particleRef.value) {
                                // TODO why is this cast necessary?
                                particles.removeEmitter(
                                    (await particleRef.value) as EmitterInstance
                                );
                                particles.containerRef.value?.refresh();
                            }
                            // TODO there are so many values marked as required that are actually optional
                            particleRef.value = particles.addEmitter({
                                // TODO this case is annoying but required because move.direction is a string rather than keyof MoveDirection
                                particles: confetti as unknown as IParticlesOptions,
                                autoPlay: true,
                                fill: false,
                                shape: "square",
                                startCount: 0,
                                life: {
                                    count: 1,
                                    delay: 0,
                                    wait: true
                                },
                                rate: {
                                    delay: 0,
                                    quantity: 10
                                },
                                size: {
                                    width: rect.width,
                                    height: rect.height,
                                    mode: "precise"
                                },
                                position: {
                                    x:
                                        (100 * (rect.x + rect.width / 2 - boundingRect.x)) /
                                        boundingRect.width,
                                    y:
                                        (100 * (rect.y + rect.height / 2 - boundingRect.y)) /
                                        boundingRect.height
                                }
                            });
                        }
                    },
                    { immediate: true }
                );
            } else {
                particleRef.value = null;
            }
        });

        return clickable;
    }

    const expSpellSelector = createSpellSelector(
        "Téchnasma",
        "Practice using the flowers to perform minor magical tricks.",
        "Gain job exp."
    );
    const flowerSpellSelector = createSpellSelector(
        "Therizó",
        "Use the magic of the flowers to harvest themselves.",
        "Gain flowers."
    );

    const spellSelectors = { expSpellSelector, flowerSpellSelector };

    const flowerSpellMilestone = createMilestone(() => ({
        shouldEarn() {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: "Achieve Harvesting Flowers Level 2",
            effectDisplay: "Unlock a new spell - Therizó"
        }
    }));
    const spellExpMilestone = createMilestone(() => ({
        shouldEarn() {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: "Achieve Harvesting Flowers Level 4",
            effectDisplay: "Unlock experience for spells"
        },
        visibility() {
            return showIf(flowerSpellMilestone.earned.value);
        }
    }));
    const burstSpellMilestone = createMilestone(() => ({
        shouldEarn() {
            return Decimal.gte(job.rawLevel.value, 6);
        },
        display: {
            requirement: "Achieve Harvesting Flowers Level 6",
            effectDisplay: "Unlock a new spell - Prōficiō"
        },
        visibility() {
            return showIf(spellExpMilestone.earned.value);
        }
    }));
    const expSpellMilestone = createMilestone(() => ({
        shouldEarn() {
            return Decimal.gte(job.rawLevel.value, 8);
        },
        display: {
            requirement: "Achieve Harvesting Flowers Level 8",
            effectDisplay: "Unlock a new spell - Scholē"
        },
        visibility() {
            return showIf(burstSpellMilestone.earned.value);
        }
    }));
    const milestones = {
        flowerSpellMilestone,
        spellExpMilestone,
        burstSpellMilestone,
        expSpellMilestone
    };
    const orderedMilestones = [
        expSpellMilestone,
        burstSpellMilestone,
        spellExpMilestone,
        flowerSpellMilestone
    ];
    const collapseMilestones = persistent<boolean>(false);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature: firstMilestone, hiddenFeatures: otherMilestones } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    this.on("preUpdate", diff => {
        if (expSpellSelector.active.value) {
            const xpGain = new Decimal(1);
            job.xp.value = Decimal.add(job.xp.value, Decimal.times(xpGain, diff));
        }
    });

    return {
        id,
        name,
        color,
        flowers,
        job,
        spellSelectors,
        milestones,
        collapseMilestones,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstMilestone.value) {
                milestonesToDisplay.push(firstMilestone.value);
            }
            return (
                <>
                    <MainDisplay
                        resource={flowers}
                        color={color}
                        v-show={flowerSpellMilestone.earned.value}
                    />
                    {renderCol(
                        ...milestonesToDisplay,
                        jsx(() => (
                            <Collapsible
                                collapsed={collapseMilestones}
                                content={jsx(() => renderCol(...otherMilestones.value))}
                                display={
                                    collapseMilestones.value
                                        ? "Show other completed milestones"
                                        : "Hide other completed milestones"
                                }
                                v-show={otherMilestones.value.length > 0}
                            />
                        ))
                    )}
                    <Spacer />
                    <div>
                        You can cast {formatWhole(maxActiveSpells.value)} spell
                        {maxActiveSpells.value === 1 ? "" : "s"} at a time
                    </div>
                    {renderRow(...Object.values(spellSelectors))}
                    {render(particles)}
                </>
            );
        })
    };
});

export default layer;
