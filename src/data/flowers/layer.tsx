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

export interface Spell<T extends string> {
    active: Ref<boolean>;
    xp: Ref<number>;
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

        const xp = persistent<number>(0);
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
            visibility: () => showIf(unref(visibleCondition))
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
            selector,
            particleEffectConfig: spellParticles,
            active: persistent<boolean>(false),
            xp,
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
        watch(spell.active, spell.updateParticleEffect);
        return spell;
    }

    const resetTree = createClickable(() => ({
        display: "reset",
        classes: { "reset-tree": true },
        onClick() {
            Object.values(spells)
                .filter(s => s.active.value)
                .forEach(s => {
                    Object.values(s.treeNodes).forEach(
                        n => ((n as GenericSpellTreeNode).bought.value = false)
                    );
                });
        }
    }));
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
                display: "Additional x1.1 job xp per job level",
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
        "Use the magic of the flowers to harvest themselves.",
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
                display: "Additional x1.1 flower gain per level",
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
                display: "Additional x1.1 faster charging for each level",
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
                display: "Additional x1.2 max charge for each level",
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

    this.on("preUpdate", diff => {
        if (xpSpell.active.value) {
            const xpGain = new Decimal(1);
            job.xp.value = Decimal.add(job.xp.value, Decimal.times(xpGain, diff));
            xpSpell.xp.value += diff;
        }
        if (flowerSpell.active.value) {
            const flowerGain = new Decimal(1);
            flowers.value = Decimal.add(flowers.value, Decimal.times(flowerGain, diff));
            flowerSpell.xp.value += diff;
        }
        if (chargeSpell.active.value) {
            chargeSpell.xp.value += diff;
        }
        if (massXpSpell.active.value) {
            massXpSpell.xp.value += diff;
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
                    <div>
                        You can cast {formatWhole(maxActiveSpells.value)} spell
                        {maxActiveSpells.value === 1 ? "" : "s"} at a time
                    </div>
                    {renderRow(...Object.values(spells).map(s => s.selector))}
                    {activeSpells.value === 1 && spellExpMilestone.earned.value ? (
                        <SpellTree>
                            {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
                            {render(Object.values(spells).find(s => s.active.value)!.tree)}
                            {render(resetTree)}
                        </SpellTree>
                    ) : null}
                    {render(particles)}
                </>
            );
        })
    };
});

export default layer;
