/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleModifierSections } from "data/common";
import experiments from "data/experiments/experiments";
import { jsx, showIf } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone, GenericMilestone } from "features/milestones/milestone";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createTabFamily } from "features/tabs/tabFamily";
import { addLayer, BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource } from "util/bignum";
import type { WithRequired } from "util/common";
import { getFirstFeature, renderColJSX, renderJSX } from "util/vue";
import { computed, ComputedRef, unref } from "vue";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
import study from "../study/study";
import generators from "../generators/generators";
import { createResource } from "features/resources/resource";
import rituals from "data/rituals/rituals";

const id = "breeding";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Breeding Plants";
    const color = "#51D126";

    const mutations = createResource<DecimalSource>(0, "mutations");

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "75%",
            y: "60%"
        },
        symbol: "emoji_nature",
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: mutations,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        visibility: () => showIf(study.milestones.jobMilestone.earned.value)
    }));

    const multiLoopMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: `Achieve ${job.name} Level 2`,
            effectDisplay: "Unlock multiple generators"
        }
    }));
    const timeBatteriesMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: `Achieve ${job.name} Level 4`,
            effectDisplay: "Unlock time passing batteries"
        },
        visibility() {
            return showIf(multiLoopMilestone.earned.value);
        }
    }));
    const bonusGeneratorMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 5);
        },
        display: {
            requirement: `Achieve ${job.name} Level 5`,
            effectDisplay: `Unlock bonus generator in "${generators.job.name}" job`
        },
        visibility() {
            return showIf(timeBatteriesMilestone.earned.value);
        }
    }));
    const resourceBatteriesMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 6);
        },
        display: {
            requirement: `Achieve ${job.name} Level 6`,
            effectDisplay: "Unlock resource gain batteries"
        },
        visibility() {
            return showIf(bonusGeneratorMilestone.earned.value);
        }
    }));
    const xpBatteriesMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 8);
        },
        display: {
            requirement: `Achieve ${job.name} Level 8`,
            effectDisplay: "Unlock xp gain batteries"
        },
        visibility() {
            return showIf(resourceBatteriesMilestone.earned.value);
        }
    }));
    const jobMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 10);
        },
        display: {
            requirement: `Achieve ${job.name} Level 10`,
            effectDisplay: `Unlock 1/2 of "${rituals.job.name}" Job`
        },
        visibility() {
            return showIf(xpBatteriesMilestone.earned.value);
        },
        onComplete() {
            if (generators.milestones.jobMilestone.earned.value) {
                addLayer(rituals, player);
            }
        }
    })) as GenericMilestone;
    const milestones = {
        multiLoopMilestone,
        timeBatteriesMilestone,
        bonusGeneratorMilestone,
        resourceBatteriesMilestone,
        xpBatteriesMilestone,
        jobMilestone
    };
    const orderedMilestones = [
        jobMilestone,
        xpBatteriesMilestone,
        resourceBatteriesMilestone,
        bonusGeneratorMilestone,
        timeBatteriesMilestone,
        multiLoopMilestone
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

    const timePassing = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: experiments.appliedTimeEffect,
            description: "Applied time",
            enabled: () =>
                experiments.job.active.value &&
                experiments.milestones.appliedTimeMilestone.earned.value &&
                experiments.selectedJob.value === id
        })),
        generators.batteries.breeding.timePassing.modifier
    ]) as WithRequired<Modifier, "revert" | "enabled" | "description">;
    const computedTimePassing = computed(() => new Decimal(timePassing.apply(1)).toNumber());

    const jobXpGain = createSequentialModifier(() => [
        generators.batteries.breeding.xpGain.modifier
    ]);

    const modifiers = {
        timePassing,
        jobXpGain
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Time Passing",
            modifier: timePassing,
            base: 1,
            visible: () =>
                experiments.milestones.appliedTimeMilestone.earned.value ||
                timeBatteriesMilestone.earned.value
        },
        {
            title: `${job.name} EXP Gain`,
            modifier: jobXpGain,
            base: 1
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

        diff = Decimal.times(diff, computedTimePassing.value).toNumber();
    });

    return {
        name,
        color,
        minWidth: 670,
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
                    <MainDisplay resource={mutations} color={color} />
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
