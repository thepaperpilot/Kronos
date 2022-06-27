/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleModifierSections } from "data/common";
import { jsx, showIf } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createTabFamily } from "features/tabs/tabFamily";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource } from "util/bignum";
import { getFirstFeature, renderColJSX, renderJSX } from "util/vue";
import { computed, ComputedRef, unref } from "vue";
import distill from "../distill/distill";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";

const id = "experiments";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Experimenting";
    const color = "#C2B280";

    const potentia = createResource<DecimalSource>(0, "potentia");

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "85%",
            y: "60%"
        },
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: potentia,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        visibility: () => showIf(distill.milestones.experimentsMilestone.earned.value)
    }));

    const spellExpMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: "Achieve Experimenting Level 2",
            effectDisplay: "???"
        }
    }));
    const flowerSpellMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: "Achieve Experimenting Level 4",
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
            requirement: "Achieve Experimenting Level 6",
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
            requirement: "Achieve Experimenting Level 8",
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

    const jobXpGain = createSequentialModifier(
        createMultiplicativeModifier(jobLevelEffect, "Experiment level (x1.1 each)")
    );

    const modifiers = {
        jobXpGain
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections([
        {
            title: "Experiment EXP Gain",
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
        potentia,
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
                    <MainDisplay resource={potentia} color={color} />
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
                </>
            );
        })
    };
});

export default layer;
