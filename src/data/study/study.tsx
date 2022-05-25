/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import Sqrt from "components/layout/Sqrt.vue";
import { createCollapsibleModifierSections } from "data/common";
import { jsx, showIf } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
import { createResource } from "features/resources/resource";
import Resource from "features/resources/Resource.vue";
import { createTab } from "features/tabs/tab";
import { createTabFamily } from "features/tabs/tabFamily";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource, format, formatWhole } from "util/bignum";
import { getFirstFeature, render, renderColJSX, renderJSX, renderRowJSX } from "util/vue";
import { computed, ComputedRef, unref } from "vue";
import distill from "../distill/distill";
import globalQuips from "../quips.json";
import { createCard, GenericCard } from "features/cards/card";
import alwaysQuips from "./quips.json";

const id = "study";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Studying";
    const color = "#9b6734";

    const properties = createResource<DecimalSource>(0, "properties");
    const insights = createResource<DecimalSource>(0, "insights");

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "25%",
            y: "20%"
        },
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: [properties, insights],
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        visibility: () => showIf(distill.milestones.studyMilestone.earned.value)
    }));

    const spellExpMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: "Achieve Studying Level 2",
            effectDisplay: "???"
        }
    }));
    const flowerSpellMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: "Achieve Studying Level 4",
            effectDisplay: "???"
        },
        visibility() {
            return showIf(spellExpMilestone.earned.value);
        }
    }));
    const chargeSpellMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 6);
        },
        display: {
            requirement: "Achieve Studying Level 6",
            effectDisplay: "???"
        },
        visibility() {
            return showIf(flowerSpellMilestone.earned.value);
        }
    }));
    const expSpellMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 8);
        },
        display: {
            requirement: "Achieve Studying Level 8",
            effectDisplay: "???"
        },
        visibility() {
            return showIf(chargeSpellMilestone.earned.value);
        }
    }));
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

    const jobLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, job.level.value)
    );

    const propertiesGain = createSequentialModifier(
        createMultiplicativeModifier(jobLevelEffect, "Studying level (x1.1 each)"),
        createMultiplicativeModifier(
            () =>
                Decimal.times(
                    increasePointsGainUses.value,
                    new Decimal(25).times(Decimal.pow(1.25, increasePointsGain.level.value))
                ),
            "Increase Properties Gain Card",
            () => Decimal.gt(increasePointsGainUses.value, 0)
        )
    );
    const computedPropertiesGain = computed(() => propertiesGain.apply(10));

    const jobXpGain = createSequentialModifier(
        createMultiplicativeModifier(
            () =>
                Decimal.times(
                    increaseXpGainUses.value,
                    new Decimal(10).times(Decimal.pow(1.5, increaseXpGain.level.value))
                ),
            "Increase Studying EXP Gain Card",
            () => Decimal.gt(increaseXpGainUses.value, 0)
        )
    );

    const modifiers = {
        propertiesGain,
        jobXpGain
    };

    const totalCards = computed(() =>
        Object.values(cards).reduce((acc, curr) => acc + curr.amount.value, 0)
    ) as ComputedRef<number>;

    const nothing = createCard(() => ({ description: "Do nothing.", metal: "mercury" }));
    const gainPoints = createCard(() => ({
        description: level =>
            `Record ${format(
                Decimal.times(computedPropertiesGain.value, Decimal.add(level, 1))
            )} properties and job exp.`,
        metal: "gold",
        actions: {
            onPlay: level => {
                const gain = Decimal.times(computedPropertiesGain.value, Decimal.add(level, 1));
                properties.value = Decimal.add(properties.value, gain);
                job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(gain));
            }
        },
        formula: jsx(() => <>properties gain x level</>),
        price: 1
    }));
    const gainBigPoints = createCard(() => ({
        description: level =>
            `Record ${format(
                Decimal.times(computedPropertiesGain.value, Decimal.add(level, 1)).pow(1.2)
            )} properties and job exp. Destroy this card.`,
        metal: "tin",
        actions: {
            onPlay: (level, canDestroy) => {
                const gain = Decimal.times(computedPropertiesGain.value, Decimal.add(level, 1)).pow(
                    1.2
                );
                properties.value = Decimal.add(properties.value, gain);
                job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(gain));
                if (canDestroy) {
                    gainBigPoints.amount.value = Math.max(gainBigPoints.amount.value - 1, 0);
                }
            }
        },
        formula: jsx(() => (
            <>
                (properties gain x level)<sup>1.2</sup>
            </>
        )),
        price: 8
    }));
    const gainInsight = createCard(() => ({
        description: level =>
            Decimal.eq(level, 0)
                ? "Gain a key insight."
                : `Gain ${formatWhole(Decimal.add(level, 1))} key insights.`,
        metal: "copper",
        actions: {
            onPlay: level => {
                insights.value = Decimal.add(insights.value, level).add(1);
            }
        },
        formula: jsx(() => <>level</>),
        price: 0
    }));
    const gainBigInsight = createCard(() => ({
        description: level =>
            `Use the size of your deck to gain ${Decimal.times(
                totalCards.value,
                Decimal.add(level, 1)
            )
                .sqrt()
                .floor()} key insights.`,
        metal: "silver",
        actions: {
            onPlay: level => {
                const amount = Decimal.times(totalCards.value, Decimal.add(level, 1))
                    .sqrt()
                    .floor();
                insights.value = Decimal.add(insights.value, amount);
            }
        },
        formula: jsx(() => (
            <>
                ⌊<Sqrt>cards x level</Sqrt>⌋
            </>
        )),
        price: 13
    }));
    const playTwice = createCard(() => ({
        description: level =>
            Decimal.eq(level, 0)
                ? "Play the next card twice. Unaffected by multi-play effects."
                : `Play the next card twice, with the effect boosted by ${Decimal.div(
                      level,
                      4
                  )} levels. Unaffected by multi-play effects.`,
        metal: "mercury",
        actions: {
            onNextCardPlay: nextCard => {
                const onPlay = nextCard.actions.onPlay;
                if (onPlay) {
                    onPlay(
                        Decimal.add(nextCard.level.value, Decimal.div(playTwice.level.value, 4)),
                        true
                    );
                }
            }
        },
        formula: jsx(() => <>(level - 1) / 4</>),
        price: 16
    }));
    const increasePointsGainUses = persistent<DecimalSource>(0);
    const increasePointsGain = createCard(() => ({
        description: level =>
            `Permanently increase studied properties gain by ${formatWhole(
                new Decimal(25).times(Decimal.pow(1.25, level))
            )}%.<br/><br/>Currently: +${formatWhole(
                Decimal.times(
                    increasePointsGainUses.value,
                    new Decimal(25).times(Decimal.pow(1.25, level))
                )
            )}%`,
        metal: "lead",
        actions: {
            onPlay: () =>
                (increasePointsGainUses.value = Decimal.add(increasePointsGainUses.value, 1))
        },
        formula: jsx(() => (
            <>
                25 x (level - 1)<sup>1.25</sup>
            </>
        )),
        uses: increasePointsGainUses,
        price: 6
    }));
    const gainXp = createCard(() => ({
        description: level =>
            `Gain xp equal to ${format(
                Decimal.div(Decimal.add(level, 1), 10)
            )}x times your number of properties.`,
        metal: "gold",
        actions: {
            onPlay: level => {
                job.xp.value = Decimal.add(
                    job.xp.value,
                    jobXpGain.apply(Decimal.add(level, 1).div(10).times(properties.value))
                );
            }
        },
        formula: jsx(() => <>properties x level / 10</>),
        price: 25
    }));
    const increaseXpGainUses = persistent<DecimalSource>(0);
    const increaseXpGain = createCard(() => ({
        description: level =>
            `Permanently increase this job's exp gain by ${formatWhole(
                new Decimal(10).times(Decimal.pow(1.5, level))
            )}%.<br/><br/>Currently: +${formatWhole(
                Decimal.times(
                    increaseXpGainUses.value,
                    new Decimal(10).times(Decimal.pow(1.5, level))
                )
            )}%`,
        metal: "tin",
        actions: {
            onPlay: () => (increaseXpGainUses.value = Decimal.add(increaseXpGainUses.value, 1))
        },
        formula: jsx(() => (
            <>
                10 x 1.5<sup>level - 1</sup>
            </>
        )),
        uses: increaseXpGainUses,
        price: 12
    }));
    const cards = {
        nothing,
        gainPoints,
        gainBigPoints,
        gainInsight,
        gainBigInsight,
        playTwice,
        increasePointsGain,
        gainXp,
        increaseXpGain
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections([
        {
            title: "Properties Gain",
            modifier: propertiesGain,
            base: 10
        },
        {
            title: "Studying EXP Gain",
            modifier: jobXpGain,
            base: 1,
            baseText: "Base (per property gained)"
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

        // TODO playing cards
    });

    const tabs = createTabFamily({
        play: () => ({
            display: "Play",
            tab: createTab(() => ({
                display: jsx(() => <>Placeholder</>)
            }))
        }),
        deck: () => ({
            display: "Deck",
            tab: createTab(() => ({
                display: jsx(() => (
                    <>
                        {renderRowJSX(
                            ...(Object.values(cards) as GenericCard[]).filter(
                                c => c.amount.value > 0
                            )
                        )}
                    </>
                ))
            }))
        }),
        shop: () => ({
            display: "Shop",
            tab: createTab(() => ({
                display: jsx(() => <>Placeholder</>)
            }))
        })
    });

    return {
        name,
        color,
        minWidth: 670,
        properties,
        insights,
        job,
        modifiers,
        milestones,
        collapseMilestones,
        modifierTabs,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstFeature.value) {
                milestonesToDisplay.push(firstFeature.value);
            }
            return (
                <>
                    <div>
                        You have <Resource resource={properties} color={color} /> properties studied
                        and <Resource resource={insights} color="darkcyan" /> key insights
                    </div>
                    <br />
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
                    {render(tabs)}
                </>
            );
        })
    };
});

export default layer;
