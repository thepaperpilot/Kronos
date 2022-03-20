/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { createClickable, GenericClickable } from "features/clickables/clickable";
import { jsx } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource } from "util/bignum";
import { EmitterInstance } from "tsparticles-plugin-emitters/EmitterInstance";
import { formatWhole } from "util/break_eternity";
import { renderCol, renderRow } from "util/vue";
import { computed, nextTick, ref, Ref, watch, WatchStopHandle } from "vue";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
import { addEmitter, removeEmitter } from "features/particles/particles";
import { IParticlesOptions } from "tsparticles-engine";
import confetti from "../confetti.json";
import "./flowers.css";

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
            style: "width: 150px; height: 150px",
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
                removeEmitter((await particleRef.value) as EmitterInstance);
                watcher?.();
            }
            if (active) {
                // TODO there are so many values marked as required that are actually optional
                const rect = layer.nodes.value[clickable.id]?.rect;
                particleRef.value = addEmitter({
                    // TODO this case is annoying but required because move.direction is a string rather than keyof MoveDirection
                    particles: confetti as unknown as IParticlesOptions,
                    autoPlay: !!rect,
                    fill: false,
                    shape: "square",
                    startCount: 0,
                    life: {
                        count: 1,
                        delay: rect ? 0 : 1,
                        wait: true
                    },
                    rate: {
                        delay: 0,
                        quantity: rect ? 10 : 0
                    },
                    size: {
                        width: rect ? rect.width : 0,
                        height: rect ? rect.height : 0,
                        mode: "precise"
                    },
                    position: {
                        x: rect ? (100 * (rect.x + rect.width / 2)) / window.innerWidth : 0,
                        y: rect ? (100 * (rect.y + rect.height / 2)) / window.innerHeight : 0
                    }
                });
                particleRef.value.then(emitter => {
                    watcher = watch(
                        () => layer.nodes.value[clickable.id]?.rect,
                        rect => {
                            if (rect && emitter.position && emitter.options.position) {
                                emitter.options.position.x =
                                    (100 * (rect.x + rect.width / 2)) / window.innerWidth;
                                emitter.options.position.y =
                                    (100 * (rect.y + rect.height / 2)) / window.innerHeight;
                                emitter.size.width = rect.width;
                                emitter.size.height = rect.height;
                                emitter.options.rate.quantity = 10;
                                emitter.externalPlay();
                            }
                        },
                        { immediate: true }
                    );
                });
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
            effectDisplay: "Unlock a new spell"
        }
    }));
    const spellTreesMilestone = createMilestone(() => ({}));

    const milestones = { flowerSpellMilestone };

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
        display: jsx(() => (
            <>
                <MainDisplay resource={flowers} color={color} />
                <div>
                    You can cast {formatWhole(maxActiveSpells.value)} spell
                    {maxActiveSpells.value === 1 ? "" : "s"} at a time
                </div>
                {renderRow(...Object.values(spellSelectors))}
                <Spacer />
                {renderCol(...Object.values(milestones))}
            </>
        ))
    };
});

export default layer;
