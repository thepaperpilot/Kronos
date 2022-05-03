/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { jsx, showIf, Visibility } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createTabFamily } from "features/tabs/tabFamily";
import { BaseLayer, createLayer } from "game/layers";
import { createSequentialModifier, createMultiplicativeModifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource } from "util/bignum";
import { getFirstFeature, renderColJSX, renderJSX } from "util/vue";
import { computed, ComputedRef } from "vue";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";

const isPastChapter1: ComputedRef<Visibility> = computed(() => showIf(main.chapter.value > 1));

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

    const spellExpMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: "Achieve Distilling Flowers Level 2",
            effectDisplay: "???"
        }
    }));
    const flowerSpellMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: "Achieve Distilling Flowers Level 4",
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
            requirement: "Achieve Distilling Flowers Level 6",
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
            requirement: "Achieve Distilling Flowers Level 8",
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
    const { firstFeature: firstMilestone, hiddenFeatures: otherMilestones } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

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
                    <Spacer />
                </>
            );
        })
    };
});

export default layer;
