/**
 * @module
 * @hidden
 */
import Spacer from "components/layout/Spacer.vue";
import SpellTree from "features/spellTree/SpellTree.vue";
import { createClickable, GenericClickable } from "features/clickables/clickable";
import { CoercableComponent, jsx, showIf, Visibility } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { BaseLayer, createLayer } from "game/layers";
import { persistent } from "game/persistence";
import Decimal, { DecimalSource, format } from "util/bignum";
import { formatWhole } from "util/break_eternity";
import { getFirstFeature, render, renderCol, renderRow } from "util/vue";
import { computed, ComputedRef, ref, Ref, unref, watch, WatchStopHandle } from "vue";
import { createParticles } from "features/particles/particles";
import Collapsible from "components/layout/Collapsible.vue";
import { Emitter, EmitterConfigV3 } from "@pixi/particle-emitter";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
import spellParticles from "./spellParticles.json";
import "./flowers.css";
import { ProcessedComputable } from "util/computed";
import {
    createTree,
    createTreeNode,
    GenericTree,
    GenericTreeNode,
    TreeBranch
} from "features/trees/tree";
import {
    createAdditiveModifier,
    createExponentialModifier,
    createMultiplicativeModifier,
    createSequentialModifier
} from "game/modifiers";

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
    visibility: Ref<Visibility>;
}

export type GenericSpellTreeNode = GenericTreeNode & {
    bought: Ref<boolean>;
};

// Empty tree node, for use in spell trees
const blank = createTreeNode(() => ({ visibility: Visibility.Hidden }));

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

    function createSpell<T extends string>(
        title: string,
        description: string,
        effect: string,
        visibleCondition: ProcessedComputable<boolean>,
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

        const visibility = computed(() => showIf(unref(visibleCondition)));

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
                        </>
                    ))
                };
            },
            style: "width: 150px; height: 150px; z-index: 2",
            classes(): Record<string, boolean> {
                return {
                    spellSelector: true,
                    activeSpell: spell.active.value,
                    can: selector.canClick.value
                };
            },
            onClick() {
                spell.active.value = !spell.active.value;
            },
            visibility
        }));

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
                if (active) {
                    particle.emit = true;
                    spell.particleEffectWatcher.value?.();
                    spell.particleEffectWatcher.value = watch(
                        [() => layer.nodes.value[selector.id]?.rect, particles.boundingRect],
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
                    spell.particleEffectWatcher.value?.();
                    spell.particleEffectWatcher.value = null;
                }
            }
        };
        watch(spell.active, active => {
            spell.updateParticleEffect(active);
            spell.castingTime.value = 0;
        });
        return spell;
    }

    const xpSpell = createSpell(
        "Téchnasma",
        "Practice using the flowers to perform minor magical tricks.",
        "Gain job exp.",
        true,
        // Tree shaped (2 levels of forking)
        {
            moreJobXpFlat: {
                display: "x2 job exp"
            },
            moreJobXpPerSpell: {
                display: "x1.25 job exp per known spell",
                requirements: ["moreJobXpFlat"]
            },
            morePotencyPerJobLevel: {
                display: "Additional x1.1 all spell potency per job level",
                requirements: ["moreJobXpFlat"]
            },
            moreJobXpPerJobLevel: {
                display: "x1.1 job xp per job level",
                requirements: ["moreJobXpPerSpell"]
            },
            moreJobXpPerSpellLevel: {
                display: "Additional x1.1 job xp per Téchnasma level",
                requirements: ["moreJobXpPerSpell"]
            },
            morePotencyOverTime: {
                display: "Additional spell potency the longer it's been consecutively casted",
                requirements: ["morePotencyPerJobLevel"]
            },
            moreSpellXpPerJobLevel: {
                display: "x1.1 spell exp per job level",
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
    const flowerSpell = createSpell(
        "Therizó",
        "Use the magic of the flowers to harvest themselves. They should make my spells more potent.",
        "Gain flowers.",
        flowerSpellMilestone,
        {
            moreFlowersFlat: {
                display: "x2 flowers gain"
            },
            moreFlowersPerSpell: {
                display: "+.25x flowers gain per known spell",
                requirements: ["moreFlowersFlat"]
            },
            moreFlowersPerLevel: {
                display: "Additional x1.1 flower gain per Therizó level",
                requirements: ["moreFlowersPerSpell"]
            },
            moreJobXpPerFlower: {
                display: "Flowers affect job exp",
                requirements: ["moreFlowersFlat"]
            },
            moreSpellXpPerFlower: {
                display: "Flowers affect spell exp",
                requirements: ["moreJobXpPerFlower"]
            },
            morePotencyPerFlower: {
                display: "Apply flower's effect on spell potency twice",
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
        chargeSpellMilestone,
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
    const massXpSpell = createSpell(
        "Scholē",
        "Practice a difficult routine that improves your ability at casting all spells.",
        "Gain spell exp.",
        expSpellMilestone,
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
                display: "+.1x other spell exp per level of this spell",
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

    const allSpellPotency = createSequentialModifier(
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, job.level.value),
            "Harvesting Flowers level (x1.1 each)"
        ),
        createMultiplicativeModifier(
            () => Decimal.log10(Decimal.add(flowers.value, 1)).add(1).sqrt(),
            "Flowers effect (sqrt(log<sub>10</sub>(flowers + 1) + 1))"
        ),
        createMultiplicativeModifier(
            () => Decimal.log10(Decimal.add(flowers.value, 1)).add(1).sqrt(),
            "Therizó skill (Re-apply flowers effect)",
            flowerSpell.treeNodes.morePotencyPerFlower.bought
        ),
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, job.level.value),
            "Scholē skill (flat)",
            massXpSpell.treeNodes.moreSpellXp.bought
        )
    );
    const computedAllSpellPotency = computed(() => allSpellPotency.apply(1));

    const allSpellXpGain = createSequentialModifier(
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, job.level.value),
            "Téchnasma skill (x1.1 per Harvesting Flowers level)",
            xpSpell.treeNodes.moreSpellXpPerJobLevel.bought
        ),
        createMultiplicativeModifier(
            () => Decimal.log10(Decimal.add(flowers.value, 1)).add(1),
            "Therizó skill (log<sub>10</sub>(flowers + 1) + 1)",
            flowerSpell.treeNodes.moreSpellXpPerFlower.bought
        ),
        createMultiplicativeModifier(
            2,
            "Therizó skill (log<sub>10</sub>(flowers + 1) + 1)",
            flowerSpell.treeNodes.moreSpellXpPerFlower.bought
        )
    );
    const computedAllSpellXpGain = computed(() => allSpellXpGain.apply(1));

    const xpSpellPotency = createSequentialModifier(
        createMultiplicativeModifier(computedAllSpellPotency, "All Spell Potency"),
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, xpSpell.level.value),
            "Téchnasma level (x1.1 each)"
        ),
        createMultiplicativeModifier(
            () => Decimal.log2(Decimal.add(xpSpell.castingTime.value, 1)).div(10).add(1),
            "Téchnasma skill (log<sub>2</sub>(casting time)/10)",
            xpSpell.treeNodes.morePotencyOverTime.bought
        )
    );
    const computedXpSpellPotency = computed(() => xpSpellPotency.apply(1));

    const xpSpellXp = createSequentialModifier(
        createAdditiveModifier(
            () => Decimal.div(massXpSpell.level.value, 10),
            "Scholē skill (+.1 per Scholē level)",
            massXpSpell.treeNodes.moreSpellXp.bought
        ),
        createMultiplicativeModifier(computedAllSpellXpGain, "All Spell Xp Gain"),
        createMultiplicativeModifier(computedXpSpellPotency, "Téchnasma potency"),
        createMultiplicativeModifier(
            2,
            "Scholē skill (flat)",
            massXpSpell.treeNodes.moreXpSpellXp.bought
        )
    );

    const jobXpGain = createSequentialModifier(
        createMultiplicativeModifier(computedXpSpellPotency, "Téchnasma potency"),
        createMultiplicativeModifier(
            2,
            "Téchnasma skill (flat)",
            xpSpell.treeNodes.moreJobXpFlat.bought
        ),
        createMultiplicativeModifier(
            () =>
                Decimal.pow(
                    1.25,
                    Object.values(spells).filter(
                        s => (s as Spell<string>).visibility.value === Visibility.Visible
                    ).length
                ),
            "Téchnasma skill (x1.25 per known spell)",
            xpSpell.treeNodes.moreJobXpPerSpell.bought
        ),
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, job.level.value),
            "Téchnasma skill (x1.1 per Harvesting Flowers level)",
            xpSpell.treeNodes.moreJobXpPerJobLevel.bought
        ),
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, xpSpell.level.value),
            "Téchnasma skill (x1.1 per Téchnasma level)",
            xpSpell.treeNodes.moreJobXpPerSpellLevel.bought
        )
    );

    const flowerSpellPotency = createSequentialModifier(
        createMultiplicativeModifier(computedAllSpellPotency, "All Spell Potency"),
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, flowerSpell.level.value),
            "Therizó level (x1.1 each)"
        ),
        createMultiplicativeModifier(
            () => Decimal.log2(Decimal.add(flowerSpell.castingTime.value, 1)).div(10).add(1),
            "Téchnasma skill (log<sub>2</sub>(casting time)/10)",
            xpSpell.treeNodes.morePotencyOverTime.bought
        )
    );
    const computedFlowerSpellPotency = computed(() => flowerSpellPotency.apply(1));

    const flowerSpellXp = createSequentialModifier(
        createAdditiveModifier(
            () => Decimal.div(massXpSpell.level.value, 10),
            "Scholē skill (+.1 per Scholē level)",
            massXpSpell.treeNodes.moreSpellXp.bought
        ),
        createMultiplicativeModifier(computedAllSpellXpGain, "All Spell Xp Gain"),
        createMultiplicativeModifier(computedFlowerSpellPotency, "Therizó potency"),
        createMultiplicativeModifier(
            2,
            "Scholē skill (flat)",
            massXpSpell.treeNodes.moreFlowerSpellXp.bought
        )
    );

    const flowerGain = createSequentialModifier(
        createAdditiveModifier(
            () =>
                Object.values(spells).filter(
                    s => (s as Spell<string>).visibility.value === Visibility.Visible
                ).length * 0.25,
            "Therizó skill (+.25 per known spell)",
            flowerSpell.treeNodes.moreFlowersPerSpell.bought
        ),
        createMultiplicativeModifier(computedFlowerSpellPotency, "Therizó potency"),
        createMultiplicativeModifier(
            2,
            "Therizó skill (flat)",
            flowerSpell.treeNodes.moreFlowersFlat.bought
        ),
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, flowerSpell.level.value),
            "Therizó skill (x1.1 per Therizó level)",
            flowerSpell.treeNodes.moreFlowersPerLevel.bought
        )
    );

    const flowerPassiveGain = createSequentialModifier(
        createAdditiveModifier(
            0.01,
            "Therizó skill (flat)",
            flowerSpell.treeNodes.passiveFlowerGain.bought
        )
    );

    const chargeSpellPotency = createSequentialModifier(
        createMultiplicativeModifier(computedAllSpellPotency, "All Spell Potency"),
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, chargeSpell.level.value),
            "Prōficiō level (x1.1 each)"
        ),
        createMultiplicativeModifier(
            () => Decimal.log2(Decimal.add(chargeSpell.castingTime.value, 1)).div(10).add(1),
            "Téchnasma skill (log<sub>2</sub>(casting time)/10)",
            xpSpell.treeNodes.morePotencyOverTime.bought
        )
    );
    const computedChargeSpellPotency = computed(() => chargeSpellPotency.apply(1));

    const chargeSpellXp = createSequentialModifier(
        createAdditiveModifier(
            () => Decimal.div(massXpSpell.level.value, 10),
            "Scholē skill (+.1 per Scholē level)",
            massXpSpell.treeNodes.moreSpellXp.bought
        ),
        createMultiplicativeModifier(computedAllSpellXpGain, "All Spell Xp Gain"),
        createMultiplicativeModifier(computedChargeSpellPotency, "Prōficiō potency"),
        createMultiplicativeModifier(
            2,
            "Scholē skill (flat)",
            massXpSpell.treeNodes.moreChargeSpellXp.bought
        )
    );

    const massXpSpellPotency = createSequentialModifier(
        createMultiplicativeModifier(computedAllSpellPotency, "All Spell Potency"),
        createMultiplicativeModifier(
            () => Decimal.pow(1.1, massXpSpell.level.value),
            "Scholē level (x1.1 each)"
        ),
        createMultiplicativeModifier(
            () => Decimal.log2(Decimal.add(massXpSpell.castingTime.value, 1)).div(10).add(1),
            "Téchnasma skill (log<sub>2</sub>(casting time)/10)",
            xpSpell.treeNodes.morePotencyOverTime.bought
        ),
        createMultiplicativeModifier(
            2,
            "Scholē skill (flat)",
            massXpSpell.treeNodes.morePotency.bought
        )
    );
    const computedMassXpSpellPotency = computed(() => massXpSpellPotency.apply(1));

    const massXpSpellXp = createSequentialModifier(
        createMultiplicativeModifier(computedAllSpellXpGain, "All Spell Xp Gain"),
        createMultiplicativeModifier(computedMassXpSpellPotency, "Scholē potency"),
        createMultiplicativeModifier(
            2,
            "Scholē skill (flat)",
            massXpSpell.treeNodes.moreMassXpSpellXp.bought
        )
    );

    const massXpGain = createSequentialModifier(
        createMultiplicativeModifier(computedMassXpSpellPotency, "Scholē potency"),
        createExponentialModifier(0.5, "(softcapped)"),
        createMultiplicativeModifier(0.1, "Base")
    );

    this.on("preUpdate", diff => {
        if (xpSpell.active.value) {
            job.xp.value = Decimal.add(job.xp.value, Decimal.times(jobXpGain.apply(1), diff));
            xpSpell.xp.value = Decimal.add(
                xpSpell.xp.value,
                Decimal.times(xpSpellXp.apply(1), diff)
            );
            xpSpell.castingTime.value += diff;
        }
        if (flowerSpell.active.value) {
            flowers.value = Decimal.add(flowers.value, Decimal.times(flowerGain.apply(1), diff));
            flowerSpell.xp.value = Decimal.add(
                flowerSpell.xp.value,
                Decimal.times(flowerSpellXp.apply(1), diff)
            );
            flowerSpell.castingTime.value += diff;
        } else {
            const passiveGain = flowerPassiveGain.apply(0);
            if (Decimal.neq(passiveGain, 0)) {
                flowers.value = Decimal.add(
                    flowers.value,
                    Decimal.times(flowerGain.apply(1), diff)
                );
            }
        }
        if (chargeSpell.active.value) {
            chargeSpell.xp.value = Decimal.add(
                chargeSpell.xp.value,
                Decimal.times(chargeSpellXp.apply(1), diff)
            );
            chargeSpell.castingTime.value += diff;
        }
        if (massXpSpell.active.value) {
            const xpEfficiency = massXpGain.apply(1);
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
                Decimal.times(massXpSpellXp.apply(1), diff)
            );
            massXpSpell.castingTime.value += diff;
        }
    });

    return {
        name,
        color,
        minWidth: 660,
        flowers,
        job,
        spells,
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
                    <div style="position: relative; z-index: 1">
                        You can cast {formatWhole(maxActiveSpells.value)} spell
                        {maxActiveSpells.value === 1 ? "" : "s"} at a time
                    </div>
                    {renderRow(...Object.values(spells).map(s => s.selector))}
                    {spellExpMilestone.earned.value
                        ? Object.values(spells)
                              .filter(s => s.active.value)
                              .map(s => <SpellTree spell={s} />)
                        : null}
                    {render(particles)}
                </>
            );
        })
    };
});

export default layer;
