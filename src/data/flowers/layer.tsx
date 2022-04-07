/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import { createClickable, GenericClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource } from "util/bignum";
import { formatWhole } from "util/break_eternity";
import { getFirstFeature, render, renderCol, renderRow } from "util/vue";
import { computed, ref, Ref, unref, watch, WatchStopHandle } from "vue";
import { createParticles } from "features/particles/particles";
import Collapsible from "components/layout/Collapsible.vue";
import { Emitter, EmitterConfigV3 } from "@pixi/particle-emitter";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
import spellParticles from "./spellParticles.json";
import "./flowers.css";
import { ProcessedComputable } from "util/computed";

export type GenericSpellSelector = GenericClickable & {
    active: Ref<boolean>;
    particleEffectWatcher: Ref<null | WatchStopHandle>;
    particleEffectConfig: EmitterConfigV3;
    particleEffect: Ref<Promise<Emitter>>;
    updateParticleEffect: (active: boolean) => void;
};

const id = "flowers";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Harvesting Flowers";
    const color = "#F1EBD9";

    const flowers = createResource<DecimalSource>(0, "flowers");

    const job = createJob(name, () => ({
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
        zIndex: -1,
        boundingRect: ref<null | DOMRect>(null),
        onContainerResized(boundingRect) {
            this.boundingRect.value = boundingRect;
        },
        onHotReload() {
            Object.values(spellSelectors).forEach(spell => {
                spell.particleEffect.value.then(e => e.destroy());
                spell.particleEffect.value = particles.addEmitter(spell.particleEffectConfig);
                spell.updateParticleEffect(spell.active.value);
            });
        }
    }));

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
    const chargeSpellMilestone = createMilestone(() => ({
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
            return showIf(chargeSpellMilestone.earned.value);
        }
    }));
    const milestones = {
        flowerSpellMilestone,
        spellExpMilestone,
        chargeSpellMilestone,
        expSpellMilestone
    };
    const orderedMilestones = [
        expSpellMilestone,
        spellExpMilestone,
        chargeSpellMilestone,
        flowerSpellMilestone
    ];
    const collapseMilestones = persistent<boolean>(true);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature: firstMilestone, hiddenFeatures: otherMilestones } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    function createSpellSelector(
        title: string,
        description: string,
        effect: string,
        visibleCondition: ProcessedComputable<boolean>
    ): GenericSpellSelector {
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
            visibility: () => showIf(unref(visibleCondition)),
            particleEffectConfig: spellParticles,
            active: persistent<boolean>(false),
            particleEffectWatcher: ref<null | WatchStopHandle>(null),
            particleEffect: ref(particles.addEmitter(spellParticles)),
            async updateParticleEffect(active: boolean) {
                const particle = await clickable.particleEffect.value;
                if (active) {
                    particle.emit = true;
                    clickable.particleEffectWatcher.value?.();
                    clickable.particleEffectWatcher.value = watch(
                        [() => layer.nodes.value[clickable.id]?.rect, particles.boundingRect],
                        async ([rect, boundingRect]) => {
                            if (rect && boundingRect) {
                                particle.cleanup();
                                particle.updateOwnerPos(
                                    rect.x + rect.width / 2 - boundingRect.x,
                                    rect.y + rect.height / 2 - boundingRect.y
                                );
                                particle.resetPositionTracking();
                            }
                        },
                        { immediate: true }
                    );
                } else {
                    particle.emit = false;
                    clickable.particleEffectWatcher.value?.();
                    clickable.particleEffectWatcher.value = null;
                }
            }
        }));
        watch(clickable.active, clickable.updateParticleEffect);

        return clickable;
    }

    const expSpellSelector = createSpellSelector(
        "Téchnasma",
        "Practice using the flowers to perform minor magical tricks.",
        "Gain job exp.",
        true
    );
    const flowerSpellSelector = createSpellSelector(
        "Therizó",
        "Use the magic of the flowers to harvest themselves.",
        "Gain flowers.",
        flowerSpellMilestone
    );
    const chargeSpellSelector = createSpellSelector(
        "Prōficiō",
        "Charge up magic to cast another spell with greater efficiency.",
        "Charge spell efficiency.",
        chargeSpellMilestone
    );
    const massExpSpellSelector = createSpellSelector(
        "Scholē",
        "Practice a difficult routine that improves your ability at casting all spells.",
        "Gain spell exp.",
        expSpellMilestone
    );

    const spellSelectors = {
        expSpellSelector,
        flowerSpellSelector,
        chargeSpellSelector,
        massExpSpellSelector
    };

    this.on("preUpdate", diff => {
        if (expSpellSelector.active.value) {
            const xpGain = new Decimal(1);
            job.xp.value = Decimal.add(job.xp.value, Decimal.times(xpGain, diff));
        }
        if (flowerSpellSelector.active.value) {
            const flowerGain = new Decimal(1);
            flowers.value = Decimal.add(flowers.value, Decimal.times(flowerGain, diff));
        }
        if (chargeSpellSelector.active.value) {
        }
        if (massExpSpellSelector.active.value) {
        }
    });

    return {
        name,
        color,
        minWidth: 640,
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
