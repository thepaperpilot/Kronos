/**
 * @module
 * @hidden
 */
import { Emitter, EmitterConfigV3 } from "@pixi/particle-emitter";
import Collapsible from "components/layout/Collapsible.vue";
import Row from "components/layout/Row.vue";
import Spacer from "components/layout/Spacer.vue";
import Notif from "components/Notif.vue";
import breeding from "data/breeding/breeding";
import experiments from "data/experiments/experiments";
import { main } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { createClickable, GenericClickable } from "features/clickables/clickable";
import { CoercableComponent, isVisible, jsx, Visibility } from "features/feature";
import { createJob } from "features/job/job";
import { createAchievement, GenericAchievement } from "features/achievements/achievement";
import { createParticles } from "features/particles/particles";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, trackBest } from "features/resources/resource";
import SpellTree from "features/spellTree/SpellTree.vue";
import { createTabFamily } from "features/tabs/tabFamily";
import {
    createTree,
    createTreeNode,
    GenericTree,
    GenericTreeNode,
    TreeBranch
} from "features/trees/tree";
import { BaseLayer, createLayer } from "game/layers";
import type { Modifier } from "game/modifiers";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier
} from "game/modifiers";
import { createDismissableNotify } from "game/notifications";
import { noPersist, persistent } from "game/persistence";
import player from "game/player";
import settings from "game/settings";
import Decimal, { DecimalSource, format } from "util/bignum";
import { formatWhole } from "util/break_eternity";
import { Direction, WithRequired } from "util/common";
import { ProcessedComputable } from "util/computed";
import { getFirstFeature, renderColJSX, renderJSX, renderRowJSX } from "util/vue";
import { computed, ComputedRef, ref, Ref, unref, watch, WatchStopHandle } from "vue";
import { useToast } from "vue-toastification";
import type { ToastID } from "vue-toastification/dist/types/types";
import { createCollapsibleModifierSections } from "../common";
import generators from "../generators/generators";
import globalQuips from "../quips.json";
import "./flowers.css";
import alwaysQuips from "./quips.json";
import spellParticles from "./spellParticles.json";
import { createBooleanRequirement } from "game/requirements";

export interface Spell<T extends string> {
    active: Ref<boolean>;
    xp: Ref<DecimalSource>;
    castingTime: Ref<number>;
    level: ComputedRef<Decimal>;
    spentPoints: ComputedRef<number>;
    levelProgress: ComputedRef<Decimal>;
    particleEffectWatcher: Ref<null | WatchStopHandle>;
    particleEffectConfig: EmitterConfigV3;
    particleEffect: Ref<Promise<Emitter>>;
    updateParticleEffect: (active: boolean) => void;
    treeNodes: Record<T, GenericSpellTreeNode>;
    tree: GenericTree;
    selector: GenericClickable;
    showNotif: Ref<boolean>;
    visibility: Ref<Visibility>;
    notif?: ToastID;
}

export type GenericSpellTreeNode = GenericTreeNode & {
    bought: Ref<boolean>;
};

const toast = useToast();

const id = "flowers";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Harvesting Flowers";
    const color = "#A626D1";

    const flowers = createResource<DecimalSource>(0, "moly");
    const bestMoly = trackBest(flowers);

    const job = createJob(name, () => ({
        color,
        image: "/harvesting.png",
        imageFocus: {
            x: "50%",
            y: "65%"
        },
        symbol: "⚘",
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: noPersist(flowers),
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        modifierModalAttrs: {
            class: "flowers-modal"
        },
        showNotif: () => Object.values(spells).some(s => s.showNotif.value)
    }));

    const activeSpells = computed(() => Object.values(spells).filter(s => s.active.value).length);
    const maxActiveSpells = computed(() => 1);

    const particles = createParticles(() => ({
        fullscreen: false,
        zIndex: -1,
        boundingRect: ref<null | DOMRect>(null),
        onContainerResized(boundingRect) {
            this.boundingRect.value = boundingRect;
        },
        onHotReload() {
            Object.values(spells).forEach(spell => {
                spell.particleEffect.value.then(e => e.destroy());
                spell.particleEffect.value = particles.addEmitter(spell.particleEffectConfig);
                spell.updateParticleEffect(spell.active.value);
            });
        }
    }));

    const spellExpMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 2)),
        display: {
            requirement: `Achieve ${job.name} Level 2`,
            effectDisplay: "Double Téchnasma potency and unlock experience for spells"
        }
    }));
    const flowerSpellMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 4)),
        display: {
            requirement: `Achieve ${job.name} Level 4`,
            effectDisplay: "Double Téchnasma potency and unlock a new spell - Therizó"
        },
        visibility: spellExpMilestone.earned
    })) as GenericAchievement;
    const chargeSpellMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 6)),
        display: {
            requirement: `Achieve ${job.name} Level 6`,
            effectDisplay: "Double Téchnasma potency and unlock a new spell - Prōficiō"
        },
        visibility: flowerSpellMilestone.earned
    })) as GenericAchievement;
    const expSpellMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 8)),
        display: {
            requirement: `Achieve ${job.name} Level 8`,
            effectDisplay: "Double Téchnasma potency and unlock a new spell - Scholē"
        },
        visibility: chargeSpellMilestone.earned
    })) as GenericAchievement;
    const milestones = {
        spellExpMilestone,
        flowerSpellMilestone,
        chargeSpellMilestone,
        expSpellMilestone
    };
    const orderedMilestones = [
        expSpellMilestone,
        chargeSpellMilestone,
        flowerSpellMilestone,
        spellExpMilestone
    ];
    const collapseMilestones = persistent<boolean>(true);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature, collapsedContent, hasCollapsedContent } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    // Empty tree node, for use in spell trees
    const blank = createTreeNode(() => ({ visibility: Visibility.Hidden }));

    function createSpell<T extends string>(
        title: string,
        description: string,
        effect: string,
        visibility: ProcessedComputable<Visibility | boolean>,
        nodes: Record<
            T,
            {
                display: CoercableComponent;
                requirements?: T[];
            }
        >,
        rows: (T | typeof blank)[][]
    ): Spell<T> {
        const treeNodes = (Object.keys(nodes) as T[]).reduce<
            Partial<Record<T, GenericSpellTreeNode>>
        >((acc, curr) => {
            const bought = persistent<boolean>(false);
            acc[curr] = createTreeNode(() => ({
                display: nodes[curr].display,
                classes() {
                    return { "spell-node": true, bought: bought.value };
                },
                bought,
                canClick() {
                    if (treeNodes[curr].bought.value) {
                        return false;
                    }
                    if (Decimal.gte(spentPoints.value, level.value)) {
                        return false;
                    }
                    if (nodes[curr].requirements?.some(r => !treeNodes[r].bought.value)) {
                        return false;
                    }
                    return true;
                },
                onClick() {
                    treeNodes[curr].bought.value = true;
                }
            })) as GenericSpellTreeNode;
            return acc;
        }, {}) as Record<T, GenericSpellTreeNode>;

        const xp = persistent<DecimalSource>(0);
        const level = computed(() => Decimal.clampMin(xp.value, 1).log10().floor());
        const spentPoints = computed(() =>
            // TODO why is this cast necessary
            Object.values<GenericSpellTreeNode>(treeNodes).reduce(
                (acc, curr) => acc + (curr.bought.value ? 1 : 0),
                0
            )
        );
        const levelProgress = computed(() => {
            const previousLevelReq = Decimal.eq(level.value, 0) ? 0 : Decimal.pow10(level.value);
            const nextLevelReq = Decimal.pow10(Decimal.add(level.value, 1));
            return Decimal.sub(xp.value, previousLevelReq)
                .div(Decimal.sub(nextLevelReq, previousLevelReq))
                .times(100);
        });

        const selector = createClickable(() => ({
            canClick(): boolean {
                return spell.active.value || activeSpells.value < maxActiveSpells.value;
            },
            display() {
                return {
                    title: `<h2>${title}</h2>`,
                    description: jsx(() => (
                        <>
                            <br />
                            <i>{description}</i>
                            <br />
                            <br />
                            <h3>{effect}</h3>
                            {spellExpMilestone.earned.value ? (
                                <div class="spell-level">
                                    <div
                                        class="spell-exp"
                                        style={`--exp: ${format(levelProgress.value)}%`}
                                    ></div>
                                    <span>
                                        ({formatWhole(Decimal.sub(level.value, spentPoints.value))}/
                                        {formatWhole(level.value)})
                                    </span>
                                </div>
                            ) : null}
                            {showNotif.value ? <Notif /> : null}
                        </>
                    ))
                };
            },
            classes(): Record<string, boolean> {
                return {
                    spellSelector: true,
                    activeSpell: spell.active.value,
                    can: unref(selector.canClick)
                };
            },
            onClick() {
                spell.active.value = !spell.active.value;
                spell.castingTime.value = 0;
            },
            visibility
        })) as Spell<T>["selector"];

        const showNotif = createDismissableNotify(selector, () =>
            rows.some(r => r.some(s => s !== blank && unref(treeNodes[s as T].canClick)))
        );

        const spell = {
            treeNodes,
            tree: createTree(() => ({
                nodes: rows.map(r =>
                    r.map(node => (node === blank ? blank : treeNodes[node as T]))
                ),
                branches: () =>
                    (Object.keys(nodes) as T[]).reduce<TreeBranch[]>((acc, curr) => {
                        return nodes[curr].requirements
                            ? [
                                  ...acc,
                                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                  ...nodes[curr].requirements!.map(r => ({
                                      startNode: treeNodes[curr],
                                      endNode: treeNodes[r],
                                      stroke: treeNodes[r].bought.value
                                          ? "#B949DE"
                                          : "var(--locked)",
                                      "stroke-width": "4px"
                                  }))
                              ]
                            : acc;
                    }, [])
            })),
            visibility,
            selector,
            showNotif,
            particleEffectConfig: spellParticles,
            active: persistent<boolean>(false),
            xp,
            castingTime: persistent<number>(0),
            level,
            spentPoints,
            levelProgress,
            particleEffectWatcher: ref<null | WatchStopHandle>(null),
            particleEffect: ref(particles.addEmitter(spellParticles)),
            async updateParticleEffect(active: boolean) {
                const particle = await spell.particleEffect.value;
                spell.particleEffectWatcher.value?.();
                if (active) {
                    spell.particleEffectWatcher.value = watch(
                        [() => layer.nodes.value[selector.id]?.rect, particles.boundingRect],
                        async ([rect, boundingRect]) => {
                            if (rect != null && boundingRect != null) {
                                particle.cleanup();
                                particle.updateOwnerPos(
                                    rect.x + rect.width / 2 - boundingRect.x,
                                    rect.y + rect.height / 2 - boundingRect.y
                                );
                                particle.resetPositionTracking();
                                particle.emit = true;
                            } else {
                                particle.emit = false;
                            }
                        },
                        { immediate: true }
                    );
                } else {
                    particle.emit = false;
                    spell.particleEffectWatcher.value = null;
                }
            }
        } as Spell<T>;

        watch(spell.active, spell.updateParticleEffect);
        watch(spell.level, (currLevel, prevLevel) => {
            if (settings.active !== player.id || Decimal.neq(currLevel, Decimal.add(prevLevel, 1)))
                return;
            if (spell.notif != null) {
                toast.dismiss(spell.notif);
            }
            spell.notif = toast.info(`${title} is now level ${currLevel}!`);
        });

        return spell;
    }

    const chargeAmount = persistent<DecimalSource>(0);
    const chargeBar = createBar(() => ({
        direction: Direction.Right,
        height: 20,
        width: 200,
        fillStyle: () =>
            `--time: ${((player.time % 100000000) / 10).toLocaleString("fullwide", {
                useGrouping: false
            })}px; --time-deg: ${((player.time % 100000000) / 100).toLocaleString("fullwide", {
                useGrouping: false
            })}deg`,
        classes: { chargeBar: true },
        progress() {
            return Decimal.div(chargeAmount.value, computedChargeCap.value);
        },
        visibility: chargeSpellMilestone.earned
    }));

    const jobLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, job.level.value)
    );

    const moreJobXpPerSpellEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.25, Object.values(spells).filter(s => isVisible(s.visibility)).length)
    );
    const morePotencyPerJobLevelEffect = jobLevelEffect;
    const moreJobXpPerJobLevelEffect = jobLevelEffect;
    const moreJobXpPerSpellLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, xpSpell.level.value)
    );
    const moreSpellXpPerJobLevelEffect = jobLevelEffect;
    const xpSpell = createSpell(
        "Téchnasma",
        "Practice using the flowers to perform minor magical tricks.",
        "Gain job exp.",
        true,
        // Tree shaped (2 levels of forking)
        {
            moreJobXpFlat: {
                display: "x4 job exp"
            },
            moreJobXpPerSpell: {
                display: jsx(() => (
                    <div>
                        x1.25 job exp per known spell
                        <br />
                        (x{format(moreJobXpPerSpellEffect.value)})
                    </div>
                )),
                requirements: ["moreJobXpFlat"]
            },
            morePotencyPerJobLevel: {
                display: jsx(() => (
                    <div>
                        Additional x1.1 all spell potency per job level
                        <br />
                        (x{format(morePotencyPerJobLevelEffect.value)})
                    </div>
                )),
                requirements: ["moreJobXpFlat"]
            },
            moreJobXpPerJobLevel: {
                display: jsx(() => (
                    <div>
                        Additional x1.1 job exp per job level
                        <br />
                        (x{format(moreJobXpPerJobLevelEffect.value)})
                    </div>
                )),
                requirements: ["moreJobXpPerSpell"]
            },
            moreJobXpPerSpellLevel: {
                display: jsx(() => (
                    <div>
                        Additional x1.1 job exp per Téchnasma level
                        <br />
                        (x{format(moreJobXpPerSpellLevelEffect.value)})
                    </div>
                )),
                requirements: ["moreJobXpPerSpell"]
            },
            morePotencyOverTime: {
                display: "Additional spell potency the longer it's been consecutively casted",
                requirements: ["morePotencyPerJobLevel"]
            },
            moreSpellXpPerJobLevel: {
                display: jsx(() => (
                    <div>
                        x1.1 all spell exp per job level
                        <br />
                        (x{format(moreSpellXpPerJobLevelEffect.value)})
                    </div>
                )),
                requirements: ["morePotencyPerJobLevel"]
            }
        },
        [
            ["moreJobXpFlat"],
            ["moreJobXpPerSpell", blank, "morePotencyPerJobLevel"],
            [
                "moreJobXpPerJobLevel",
                "moreJobXpPerSpellLevel",
                "morePotencyOverTime",
                "moreSpellXpPerJobLevel"
            ]
        ]
    );

    const moreFlowersPerSpellEffect: ComputedRef<DecimalSource> = computed(
        () => Object.values(spells).filter(s => isVisible(s.visibility)).length * 0.25
    );
    const moreFlowersPerLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, flowerSpell.level.value)
    );
    const flowersEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.log10(Decimal.add(flowers.value, 1)).pow(0.777).add(1)
    );
    const flowersEffectDescription = (
        <>
            log<sub>2</sub>(flowers + 1)<sup>0.777</sup> + 1
        </>
    );
    const flowerSpell = createSpell(
        "Therizó",
        "Use the magic of the flowers to harvest themselves. They should make my spells more potent.",
        "Gain flowers.",
        flowerSpellMilestone.earned,
        {
            moreFlowersFlat: {
                display: "x2 flowers gain"
            },
            moreFlowersPerSpell: {
                display: jsx(() => (
                    <div>
                        +.25x Therizó potency per known spell
                        <br />
                        (+{format(moreFlowersPerSpellEffect.value)})
                    </div>
                )),
                requirements: ["moreFlowersFlat"]
            },
            moreFlowersPerLevel: {
                display: jsx(() => (
                    <div>
                        Additional x1.1 Therizó potency per Therizó level
                        <br />
                        (x{format(moreFlowersPerLevelEffect.value)})
                    </div>
                )),
                requirements: ["moreFlowersPerSpell"]
            },
            moreJobXpPerFlower: {
                display: jsx(() => (
                    <div>
                        Flowers affect job exp
                        <br />
                        (x{format(flowersEffect.value)})
                    </div>
                )),
                requirements: ["moreFlowersFlat"]
            },
            moreSpellXpPerFlower: {
                display: jsx(() => (
                    <div>
                        Flowers affect all spell exp
                        <br />
                        (x{format(flowersEffect.value)})
                    </div>
                )),
                requirements: ["moreJobXpPerFlower"]
            },
            morePotencyPerFlower: {
                display: jsx(() => (
                    <div>
                        Flower's affect all spell potency twice
                        <br />
                        (x{format(flowersEffect.value)})
                    </div>
                )),
                requirements: ["moreSpellXpPerFlower"]
            },
            passiveFlowerGain: {
                display: "1% of flower gain when casting other spells",
                requirements: ["moreSpellXpPerFlower"]
            }
        },
        // Scythe shape (or flipped F)
        [
            ["moreFlowersPerLevel", "moreFlowersPerSpell", "moreFlowersFlat"],
            [blank, blank, "moreJobXpPerFlower"],
            [blank, "passiveFlowerGain", "moreSpellXpPerFlower"],
            [blank, blank, "morePotencyPerFlower"]
        ]
    );

    const chargeSpell = createSpell(
        "Prōficiō",
        "Charge up magic to cast another spell with greater potency.",
        "Charge spell potency.",
        chargeSpellMilestone.earned,
        // Single fork into two bars
        {
            spellEff: {
                display: "x1.25 spell potency when discharging"
            },
            fasterChargeFlat: {
                display: "x1.5 faster charging",
                requirements: ["spellEff"]
            },
            fasterChargeByLevel: {
                display: "Additional x1.1 faster charging for each Prōficiō level",
                requirements: ["fasterChargeFlat"]
            },
            betterChargeMulti: {
                display: "Charge effect on spells is raised ^1.1",
                requirements: ["fasterChargeByLevel"]
            },
            largerChargeFlat: {
                display: "x1.5 max charge",
                requirements: ["spellEff"]
            },
            largerChargeByLevel: {
                display: "Additional x1.2 max charge for each Prōficiō level",
                requirements: ["largerChargeFlat"]
            },
            slowerDischargeByLevel: {
                display: "x1.05 slower discharge for each of that spell's levels",
                requirements: ["largerChargeByLevel"]
            }
        },
        [
            ["spellEff"],
            ["fasterChargeFlat", "largerChargeFlat"],
            ["fasterChargeByLevel", "largerChargeByLevel"],
            ["betterChargeMulti", "slowerDischargeByLevel"]
        ]
    );

    const moreXpPerLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.div(massXpSpell.level.value, 10)
    );
    const massXpSpell = createSpell(
        "Scholē",
        "Practice a difficult routine that improves your ability at casting all spells.",
        "Gain spell exp.",
        expSpellMilestone.earned,
        // Star burst
        {
            moreSpellXp: {
                display: "All spells gain double exp"
            },
            moreXpSpellXp: {
                display: "Téchnasma spell gains double exp",
                requirements: ["moreSpellXp"]
            },
            moreFlowerSpellXp: {
                display: "Therizó spell gains double exp",
                requirements: ["moreSpellXp"]
            },
            moreChargeSpellXp: {
                display: "Prōficiō spell gains double exp",
                requirements: ["moreSpellXp"]
            },
            moreMassXpSpellXp: {
                display: "Scholē spell gains double exp",
                requirements: ["moreSpellXp"]
            },
            moreXpPerLevel: {
                display: jsx(() => (
                    <div>
                        +.1x other spell exp per level of this spell
                        <br />
                        (+{format(moreXpPerLevelEffect.value)})
                    </div>
                )),
                requirements: ["moreSpellXp"]
            },
            morePotency: {
                display: "Double potency of this spell",
                requirements: ["moreSpellXp"]
            }
        },
        [
            ["moreXpSpellXp", "moreFlowerSpellXp"],
            ["moreXpPerLevel", "moreSpellXp", "morePotency"],
            ["moreChargeSpellXp", "moreMassXpSpellXp"]
        ]
    );

    const spells = {
        xpSpell,
        flowerSpell,
        chargeSpell,
        massXpSpell
    };

    const timePassing = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: experiments.appliedTimeEffect,
            description: "Applied time",
            enabled: () =>
                experiments.job.active.value &&
                experiments.milestones.appliedTimeMilestone.earned.value &&
                experiments.selectedJob.value === id
        })),
        generators.batteries.flowers.timePassing.modifier
    ]) as WithRequired<Modifier, "invert" | "enabled" | "description">;
    const computedTimePassing = computed(() => timePassing.apply(1));

    const chargeMult = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 1.25,
            description: "Prōficiō skill (x1.25 when discharging)",
            enabled: () =>
                chargeSpell.treeNodes.spellEff.bought.value && Decimal.gt(chargeAmount.value, 0)
        })),
        createExponentialModifier(() => ({
            exponent: 1.1,
            description: "Prōficiō skill (flat)",
            enabled: chargeSpell.treeNodes.betterChargeMulti.bought
        }))
    ]);
    const computedChargeMult = computed(() =>
        chargeMult.apply(Decimal.log10(Decimal.add(chargeAmount.value, 1)).add(1))
    );

    const allSpellPotency = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: jobLevelEffect,
            description: `${job.name} level (x1.1 each)`
        })),
        createMultiplicativeModifier(() => ({
            multiplier: morePotencyPerJobLevelEffect,
            description: `Téchnasma skill (x1.1 per ${job.name} level)`,
            enabled: xpSpell.treeNodes.morePotencyPerJobLevel.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: flowersEffect,
            description: jsx(() => <>Flowers Effect ({flowersEffectDescription})</>)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: flowersEffect,
            description: "Therizó skill (Re-apply flowers effect)",
            enabled: flowerSpell.treeNodes.morePotencyPerFlower.bought
        }))
    ]);
    const computedAllSpellPotency = computed(() => allSpellPotency.apply(1));

    const allSpellXpGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: moreSpellXpPerJobLevelEffect,
            description: `Téchnasma skill (x1.1 per ${job.name} level)`,
            enabled: xpSpell.treeNodes.moreSpellXpPerJobLevel.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: flowersEffect,
            description: jsx(() => <>Therizó skill ({flowersEffectDescription})</>),
            enabled: flowerSpell.treeNodes.moreSpellXpPerFlower.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholē skill (flat)",
            enabled: massXpSpell.treeNodes.moreSpellXp.bought
        }))
    ]);
    const computedAllSpellXpGain = computed(() => allSpellXpGain.apply(1));

    const xpSpellPotency = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: computedAllSpellPotency,
            description: "All Spell Potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Spell EXP milestone (flat)",
            enabled: spellExpMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Therizó milestone (flat)",
            enabled: flowerSpellMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Prōficiō milestone (flat)",
            enabled: chargeSpellMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholē milestone (flat)",
            enabled: expSpellMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.1, xpSpell.level.value),
            description: "Téchnasma level (x1.1 each)",
            enabled: spellExpMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.log2(Decimal.add(xpSpell.castingTime.value, 1)).div(10).add(1),
            description: jsx(() => (
                <>
                    Téchnasma skill (log<sub>2</sub>(casting time)/10)
                </>
            )),
            enabled: xpSpell.treeNodes.morePotencyOverTime.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedChargeMult,
            description: "Charge Multiplier",
            enabled: chargeSpellMilestone.earned
        }))
    ]);
    const computedXpSpellPotency = computed(() => xpSpellPotency.apply(1));

    const xpSpellXp = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(massXpSpell.level.value, 10),
            description: "Scholē skill (+.1 per Scholē level)",
            enabled: massXpSpell.treeNodes.moreXpPerLevel.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedAllSpellXpGain,
            description: "All Spell EXP Gain"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedXpSpellPotency,
            description: "Téchnasma potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholē skill (flat)",
            enabled: massXpSpell.treeNodes.moreXpSpellXp.bought
        }))
    ]);

    const jobXpGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: computedXpSpellPotency,
            description: "Téchnasma potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: jobLevelEffect,
            description: `${job.name} level (x1.1 each)`
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 4,
            description: "Téchnasma skill (flat)",
            enabled: xpSpell.treeNodes.moreJobXpFlat.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: moreJobXpPerSpellEffect,
            description: "Téchnasma skill (x1.25 per known spell)",
            enabled: xpSpell.treeNodes.moreJobXpPerSpell.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: moreJobXpPerJobLevelEffect,
            description: `Téchnasma skill (x1.1 per ${job.name} level)`,
            enabled: xpSpell.treeNodes.moreJobXpPerJobLevel.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: moreJobXpPerSpellLevelEffect,
            description: "Téchnasma skill (x1.1 per Téchnasma level)",
            enabled: xpSpell.treeNodes.moreJobXpPerSpellLevel.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: flowersEffect,
            description: jsx(() => <>Flowers Effect ({flowersEffectDescription})</>),
            enabled: flowerSpell.treeNodes.moreJobXpPerFlower.bought
        })),
        generators.batteries.study.xpGain.modifier
    ]) as WithRequired<Modifier, "description" | "invert">;

    const jobXpDischargeRate = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1 / 1.05, xpSpell.level.value ?? 0),
            description: "Therizó skill (/1.05 per Téchnasma level)",
            enabled: chargeSpell.treeNodes.slowerDischargeByLevel.bought,
            smallerIsBetter: true
        }))
    ]);
    const computedJobXpDischargeRate = computed(() =>
        jobXpDischargeRate.apply(computedBaseDischargeRate.value)
    );

    const flowerSpellPotency = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: moreFlowersPerSpellEffect,
            description: "Therizó skill (+.25 per known spell)",
            enabled: flowerSpell.treeNodes.moreFlowersPerSpell.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedAllSpellPotency,
            description: "All Spell Potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.1, flowerSpell.level.value),
            description: "Therizó level (x1.1 each)",
            enabled: spellExpMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.log2(Decimal.add(flowerSpell.castingTime.value, 1)).div(10).add(1),
            description: jsx(() => (
                <>
                    Téchnasma skill (log<sub>2</sub>(casting time)/10)
                </>
            )),
            enabled: xpSpell.treeNodes.morePotencyOverTime.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedChargeMult,
            description: "Charge Multiplier",
            enabled: chargeSpellMilestone.earned
        }))
    ]);
    const computedFlowerSpellPotency = computed(() => flowerSpellPotency.apply(1));

    const flowerSpellXp = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: moreXpPerLevelEffect,
            description: "Scholē skill (+.1 per Scholē level)",
            enabled: massXpSpell.treeNodes.moreXpPerLevel.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedAllSpellXpGain,
            description: "All Spell EXP Gain"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedFlowerSpellPotency,
            description: "Therizó potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholē skill (flat)",
            enabled: massXpSpell.treeNodes.moreFlowerSpellXp.bought
        }))
    ]);

    const flowerGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: computedFlowerSpellPotency,
            description: "Therizó potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Therizó skill (flat)",
            enabled: flowerSpell.treeNodes.moreFlowersFlat.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: moreFlowersPerLevelEffect,
            description: "Therizó skill (x1.1 per Therizó level)",
            enabled: flowerSpell.treeNodes.moreFlowersPerLevel.bought
        })),
        generators.batteries.study.resourceGain.modifier,
        breeding.plants.moly.modifier
    ]) as WithRequired<Modifier, "description" | "invert">;
    const computedFlowerGain = computed(() => flowerGain.apply(0));

    const flowerPassiveGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: 0.01,
            description: "Therizó skill (flat)",
            enabled: flowerSpell.treeNodes.passiveFlowerGain.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedFlowerGain,
            description: "Flower gain"
        }))
    ]);

    const flowerDischargeRate = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1 / 1.05, flowerSpell.level.value ?? 0),
            description: "Therizó skill (/1.05 per Therizó level)",
            enabled: chargeSpell.treeNodes.slowerDischargeByLevel.bought,
            smallerIsBetter: true
        }))
    ]);
    const computedFlowerDischargeRate = computed(() =>
        flowerDischargeRate.apply(computedBaseDischargeRate.value)
    );

    const chargeSpellPotency = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: computedAllSpellPotency,
            description: "All Spell Potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.1, chargeSpell.level.value),
            description: "Prōficiō level (x1.1 each)"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.log2(Decimal.add(chargeSpell.castingTime.value, 1)).div(10).add(1),
            description: jsx(() => (
                <>
                    Téchnasma skill (log<sub>2</sub>(casting time)/10)
                </>
            )),
            enabled: xpSpell.treeNodes.morePotencyOverTime.bought
        }))
    ]);
    const computedChargeSpellPotency = computed(() => chargeSpellPotency.apply(1));

    const chargeSpellXp = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(massXpSpell.level.value, 10),
            description: "Scholē skill (+.1 per Scholē level)",
            enabled: massXpSpell.treeNodes.moreXpPerLevel.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedAllSpellXpGain,
            description: "All Spell EXP Gain"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedChargeSpellPotency,
            description: "Prōficiō potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholē skill (flat)",
            enabled: massXpSpell.treeNodes.moreChargeSpellXp.bought
        }))
    ]);

    const chargeCap = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: computedChargeSpellPotency,
            description: "Prōficiō potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.5,
            description: "Prōficiō skill (flat)",
            enabled: chargeSpell.treeNodes.largerChargeFlat.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.2, chargeSpell.level.value),
            description: "Prōficiō skill (x1.2 per Prōficiō level)",
            enabled: chargeSpell.treeNodes.largerChargeByLevel.bought
        }))
    ]);
    const computedChargeCap = computed(() => chargeCap.apply(0));

    const chargeRate = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(computedChargeSpellPotency.value, 10),
            description: "Prōficiō potency (/10)"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.5,
            description: "Prōficiō skill (flat)",
            enabled: chargeSpell.treeNodes.fasterChargeFlat.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.1, chargeSpell.level.value),
            description: "Prōficiō skill (x1.1 per Prōficiō level)",
            enabled: chargeSpell.treeNodes.fasterChargeFlat.bought
        }))
    ]);
    const computedChargeRate = computed(() => chargeRate.apply(0));

    const baseDischargeRate = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.div(computedChargeSpellPotency.value, 10),
            description: "Prōficiō potency (/10)",
            smallerIsBetter: true
        }))
    ]);
    const computedBaseDischargeRate = computed(() => baseDischargeRate.apply(0));

    const massXpSpellPotency = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: computedAllSpellPotency,
            description: "All Spell Potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.1, massXpSpell.level.value),
            description: "Scholē level (x1.1 each)"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () =>
                Decimal.log2(Decimal.add(massXpSpell.castingTime.value, 1)).div(10).add(1),
            description: jsx(() => (
                <>
                    Téchnasma skill (log<sub>2</sub>(casting time)/10)
                </>
            )),
            enabled: xpSpell.treeNodes.morePotencyOverTime.bought
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedChargeMult,
            description: "Charge Multiplier",
            enabled: chargeSpellMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholē skill (flat)",
            enabled: massXpSpell.treeNodes.morePotency.bought
        }))
    ]);
    const computedMassXpSpellPotency = computed(() => massXpSpellPotency.apply(1));

    const massXpSpellXp = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: computedAllSpellXpGain,
            description: "All Spell EXP Gain"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: computedMassXpSpellPotency,
            description: "Scholē potency"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Scholē skill (flat)",
            enabled: massXpSpell.treeNodes.moreMassXpSpellXp.bought
        }))
    ]);

    const massXpGain = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.times(computedMassXpSpellPotency.value, 1),
            description: "Scholē potency"
        })),
        createExponentialModifier(() => ({
            exponent: 0.9,
            description: "(softcapped)"
        }))
    ]);

    const massXpDischargeRate = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1 / 1.05, massXpSpell.level.value ?? 0),
            description: "Prōficiō skill (/1.05 per Scholē level)",
            enabled: chargeSpell.treeNodes.slowerDischargeByLevel.bought,
            smallerIsBetter: true
        }))
    ]);
    const computedMassXpDischargeRate = computed(() =>
        massXpDischargeRate.apply(computedBaseDischargeRate.value)
    );

    const modifiers = {
        timePassing,
        chargeMult,
        allSpellPotency,
        allSpellXpGain,
        xpSpellPotency,
        xpSpellXp,
        jobXpGain,
        jobXpDischargeRate,
        flowerSpellPotency,
        flowerSpellXp,
        flowerGain,
        flowerPassiveGain,
        flowerDischargeRate,
        chargeSpellPotency,
        chargeSpellXp,
        chargeCap,
        chargeRate,
        baseDischargeRate,
        massXpSpellPotency,
        massXpSpellXp,
        massXpGain,
        massXpDischargeRate
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
            title: "Harvesting Flowers EXP Gain",
            subtitle: "When Téchnasma is active",
            modifier: jobXpGain,
            base: 0,
            unit: "/sec"
        },
        {
            title: "All Spell Potency",
            modifier: allSpellPotency
        },
        {
            title: "All Spell EXP Gain",
            subtitle: "When the spell is active",
            modifier: allSpellXpGain,
            unit: "/sec"
        },
        {
            title: "Flowers Gain",
            subtitle: "When Therizó is active",
            modifier: flowerGain,
            base: 0,
            unit: "/sec",
            visible: flowerSpellMilestone.earned
        },
        {
            title: "Flowers Gain",
            subtitle: "When Therizó is NOT active",
            modifier: flowerPassiveGain,
            base: 0,
            unit: "/sec",
            visible: () =>
                flowerSpellMilestone.earned.value && Decimal.neq(flowerPassiveGain.apply(0), 0)
        }
    ]);
    const [xpSpellTab, xpSpellTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Téchnasma Potency",
            modifier: xpSpellPotency
        },
        {
            title: "Téchnasma EXP Gain",
            subtitle: "When Téchnasma is active",
            modifier: xpSpellXp,
            unit: "/sec"
        },
        {
            title: "Discharge Rate",
            subtitle: "When Téchnasma is active",
            modifier: jobXpDischargeRate,
            base: computedBaseDischargeRate,
            unit: "/sec",
            visible: chargeSpellMilestone.earned,
            smallerIsBetter: true
        }
    ]);
    const [flowerSpellTab, flowerSpellTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Therizó Potency",
            modifier: flowerSpellPotency
        },
        {
            title: "Therizó EXP Gain",
            subtitle: "When Therizó is active",
            modifier: flowerSpellXp,
            base: 0.1,
            unit: "/sec"
        },
        {
            title: "Discharge Rate",
            subtitle: "When Therizó is active",
            modifier: flowerDischargeRate,
            base: computedBaseDischargeRate,
            unit: "/sec",
            visible: chargeSpellMilestone.earned,
            smallerIsBetter: true
        }
    ]);
    const [chargeSpellTab, chargeSpellTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Prōficiō Potency",
            modifier: chargeSpellPotency
        },
        {
            title: "Prōficiō EXP Gain",
            subtitle: "When Prōficiō is active",
            modifier: chargeSpellXp,
            base: 0.01,
            unit: "/sec"
        },
        {
            title: "Charge Multiplier",
            subtitle: "When a non-Prōficiō spell is active",
            modifier: chargeMult,
            base: () => Decimal.log2(Decimal.add(chargeAmount.value, 1)).add(1),
            unit: "x",
            baseText: jsx(() => (
                <>
                    Base (log<sub>2</sub>(charge + 1) + 1)
                </>
            ))
        },
        {
            title: "Charge Rate",
            subtitle: "When Prōficiō is active",
            modifier: chargeRate,
            base: 0,
            unit: "/sec"
        },
        {
            title: "Base Discharge Rate",
            subtitle: "When a non-Prōficiō spell is active",
            modifier: baseDischargeRate,
            base: 0,
            unit: "/sec",
            smallerIsBetter: true
        },
        {
            title: "Maximum Charge",
            modifier: chargeCap,
            base: 0
        }
    ]);
    const [massXpSpellTab, massXpSpellTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Scholē Potency",
            modifier: massXpSpellPotency
        },
        {
            title: "Scholē EXP Gain",
            subtitle: "When Scholē is active",
            modifier: massXpSpellXp,
            base: 0.001,
            unit: "/sec"
        },
        {
            title: "Other Spell EXP Gain Efficiency",
            subtitle: "When Scholē is active",
            modifier: massXpGain,
            base: 0,
            unit: "%"
        },
        {
            title: "Discharge Rate",
            subtitle: "When Scholē is active",
            modifier: massXpDischargeRate,
            base: computedBaseDischargeRate,
            unit: "/sec",
            visible: chargeSpellMilestone.earned,
            smallerIsBetter: true
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
            xpSpell: () => ({
                display: "Téchnasma",
                glowColor(): string {
                    return modifierTabs.activeTab.value === this.tab ? color : "";
                },
                tab: xpSpellTab,
                xpSpellTabCollapsed
            }),
            flowerSpell: () => ({
                display: "Therizó",
                visibility: flowerSpellMilestone.earned,
                glowColor(): string {
                    return modifierTabs.activeTab.value === this.tab ? color : "";
                },
                tab: flowerSpellTab,
                flowerSpellTabCollapsed
            }),
            chargeSpell: () => ({
                display: "Prōficiō",
                visibility: chargeSpellMilestone.earned,
                glowColor(): string {
                    return modifierTabs.activeTab.value === this.tab ? color : "";
                },
                tab: chargeSpellTab,
                chargeSpellTabCollapsed
            }),
            massXpSpell: () => ({
                display: "Scholē",
                visibility: expSpellMilestone.earned,
                glowColor(): string {
                    return modifierTabs.activeTab.value === this.tab ? color : "";
                },
                tab: massXpSpellTab,
                massXpSpellTabCollapsed
            })
        },
        () => ({
            style: `--layer-color: ${color}`
        })
    );

    this.on("update", diff => {
        if (!job.active.value) return;

        diff = Decimal.times(diff, computedTimePassing.value).toNumber();

        if (xpSpell.active.value) {
            job.xp.value = Decimal.add(job.xp.value, Decimal.times(jobXpGain.apply(0), diff));
            if (spellExpMilestone.earned.value) {
                xpSpell.xp.value = Decimal.add(
                    xpSpell.xp.value,
                    Decimal.times(xpSpellXp.apply(1), diff)
                );
            }
            xpSpell.castingTime.value += diff;
            chargeAmount.value = Decimal.max(
                Decimal.sub(
                    chargeAmount.value,
                    Decimal.times(computedJobXpDischargeRate.value, diff)
                ),
                0
            );
        }
        if (flowerSpell.active.value) {
            flowers.value = Decimal.min(
                main.chapter.value > 1 ? Decimal.dInf : 10000000,
                Decimal.add(flowers.value, Decimal.times(flowerGain.apply(0), diff))
            );
            if (spellExpMilestone.earned.value) {
                flowerSpell.xp.value = Decimal.add(
                    flowerSpell.xp.value,
                    Decimal.times(flowerSpellXp.apply(0.1), diff)
                );
            }
            flowerSpell.castingTime.value += diff;
            chargeAmount.value = Decimal.max(
                Decimal.sub(
                    chargeAmount.value,
                    Decimal.times(computedFlowerDischargeRate.value, diff)
                ),
                0
            );
        } else {
            const passiveGain = flowerPassiveGain.apply(0);
            if (Decimal.neq(passiveGain, 0)) {
                flowers.value = Decimal.min(
                    main.chapter.value > 1 ? Decimal.dInf : 10000000,
                    Decimal.add(flowers.value, Decimal.times(passiveGain, diff))
                );
            }
        }
        if (chargeSpell.active.value) {
            chargeSpell.xp.value = Decimal.add(
                chargeSpell.xp.value,
                Decimal.times(chargeSpellXp.apply(0.01), diff)
            );
            chargeSpell.castingTime.value += diff;
            chargeAmount.value = Decimal.min(
                Decimal.add(chargeAmount.value, Decimal.times(computedChargeRate.value, diff)),
                computedChargeCap.value
            );
        }
        if (massXpSpell.active.value) {
            const xpEfficiency = Decimal.div(massXpGain.apply(0), 100);
            xpSpell.xp.value = Decimal.add(
                xpSpell.xp.value,
                Decimal.times(xpSpellXp.apply(xpEfficiency), diff)
            );
            flowerSpell.xp.value = Decimal.add(
                flowerSpell.xp.value,
                Decimal.times(flowerSpellXp.apply(xpEfficiency), diff)
            );
            chargeSpell.xp.value = Decimal.add(
                chargeSpell.xp.value,
                Decimal.times(chargeSpellXp.apply(xpEfficiency), diff)
            );
            massXpSpell.xp.value = Decimal.add(
                massXpSpell.xp.value,
                Decimal.times(massXpSpellXp.apply(0.001), diff)
            );
            massXpSpell.castingTime.value += diff;
            chargeAmount.value = Decimal.max(
                Decimal.sub(
                    chargeAmount.value,
                    Decimal.times(computedMassXpDischargeRate.value, diff)
                ),
                0
            );
        }
    });

    return {
        name,
        color,
        minWidth: 670,
        flowers,
        bestMoly,
        job,
        spells,
        modifiers,
        milestones,
        collapseMilestones,
        chargeAmount,
        modifierTabs,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstFeature.value) {
                milestonesToDisplay.push(firstFeature.value);
            }
            return (
                <>
                    <MainDisplay
                        resource={flowers}
                        color={color}
                        v-show={flowerSpellMilestone.earned.value}
                        effectDisplay={`multiplying spell potency by x${format(
                            flowersEffect.value
                        )}`}
                    />
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
                    <div style="position: relative; z-index: 1">
                        You can cast {formatWhole(maxActiveSpells.value)} spell
                        {maxActiveSpells.value === 1 ? "" : "s"} at a time
                    </div>
                    {renderRowJSX(...Object.values(spells).map(s => s.selector))}
                    {chargeSpellMilestone.earned.value ? (
                        <Row style="margin-top: 40px !important; margin-bottom: -20px;">
                            {renderJSX(chargeBar)}
                            <span style="margin-left: 10px">
                                {format(computedChargeMult.value)}x
                            </span>
                        </Row>
                    ) : null}
                    {spellExpMilestone.earned.value
                        ? Object.values(spells)
                              .filter(s => s.active.value)
                              .map(s => <SpellTree spell={s} />)
                        : null}
                    {renderJSX(particles)}
                </>
            );
        })
    };
});

export default layer;
