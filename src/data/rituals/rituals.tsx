/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleModifierSections } from "data/common";
import experiments from "data/experiments/experiments";
import { JobKeys } from "data/projEntry";
import { Component, GatherProps, jsx, Visibility } from "features/feature";
import { createJob } from "features/job/job";
import { createAchievement, GenericAchievement } from "features/achievements/achievement";
import { createResource } from "features/resources/resource";
import { createTabFamily } from "features/tabs/tabFamily";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource } from "util/bignum";
import type { WithRequired } from "util/common";
import { Computable, convertComputable, ProcessedComputable } from "util/computed";
import { getFirstFeature, renderColJSX, renderJSX, VueFeature } from "util/vue";
import { computed, ComputedRef, unref } from "vue";
import breeding from "../breeding/breeding";
import generators from "../generators/generators";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
import RitualComponent from "./Ritual.vue";
import { createBooleanRequirement } from "game/requirements";

export interface RitualOptions {
    name: string;
    visibility?: Computable<Visibility | boolean>;
}

export interface Ritual extends VueFeature {
    name: string;
    visibility: ProcessedComputable<Visibility | boolean>;
}

const id = "rituals";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Performing Rituals";
    const color = "#D12626";

    const activeRituals = createResource<number>(
        computed(() => 0),
        "active rituals"
    );

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "75%",
            y: "60%"
        },
        symbol: "⎊",
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: activeRituals,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(modifierTabs)),
        visibility: () =>
            generators.milestones.jobMilestone.earned.value &&
            breeding.milestones.jobMilestone.earned.value
    }));

    const selectedRunes = persistent<(JobKeys | "")[][]>([]);

    const fourthColMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 2)),
        display: {
            requirement: `Achieve ${job.name} Level 2`,
            effectDisplay: `Unlock fourth column of runes and ${emolumentum.name}`
        }
    }));
    const fourthRowMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 4)),
        display: {
            requirement: `Achieve ${job.name} Level 4`,
            effectDisplay: `Unlock fourth row of runes and ${melius.name}`
        },
        visibility: fourthColMilestone.earned
    }));
    const timeSlotMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 5)),
        display: {
            requirement: `Achieve ${job.name} Level 5`,
            effectDisplay: "Unlock a time slot"
        },
        visibility: fourthRowMilestone.earned
    }));
    const fifthColMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 6)),
        display: {
            requirement: `Achieve ${job.name} Level 6`,
            effectDisplay: `Unlock fifth column of runes and ${collegium.name}`
        },
        visibility: timeSlotMilestone.earned
    }));
    const fifthRowMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 8)),
        display: {
            requirement: `Achieve ${job.name} Level 8`,
            effectDisplay: `Unlock fifth row of runes and ${celeritas.name}`
        },
        visibility: fifthColMilestone.earned
    }));
    const genesisMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 10)),
        display: {
            requirement: `Achieve ${job.name} Level 10`,
            effectDisplay: `Unlock Ritual of Génesis`
        },
        visibility: fifthRowMilestone.earned
    })) as GenericAchievement;
    const milestones = {
        fourthColMilestone,
        fourthRowMilestone,
        timeSlotMilestone,
        fifthColMilestone,
        fifthRowMilestone,
        genesisMilestone
    };
    const orderedMilestones = [
        genesisMilestone,
        fifthRowMilestone,
        fifthColMilestone,
        timeSlotMilestone,
        fourthRowMilestone,
        fourthColMilestone
    ];
    const collapseMilestones = persistent<boolean>(true);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature, collapsedContent, hasCollapsedContent } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    const runeRows = computed(() => {
        let rows = 3;

        if (fourthRowMilestone.earned.value) {
            rows++;
        }
        if (fifthRowMilestone.earned.value) {
            rows++;
        }

        return rows;
    });
    const runeCols = computed(() => {
        let cols = 3;

        if (fourthColMilestone.earned.value) {
            cols++;
        }
        if (fifthColMilestone.earned.value) {
            cols++;
        }

        return cols;
    });

    function createRitual({ name, visibility }: RitualOptions): Ritual {
        const computedVisibility = convertComputable(visibility ?? Visibility.Visible);

        return {
            name,
            visibility: computedVisibility,
            [Component]: RitualComponent,
            [GatherProps]: function (this: Ritual) {
                return {};
            }
        };
    }

    const doctrina = createRitual({
        name: "Ritual of Doctrina"
    });

    const emolumentum = createRitual({
        name: "Ritual of Emolumentum",
        visibility: fourthColMilestone.earned
    });

    const melius = createRitual({
        name: "Ritual of Melius",
        visibility: fourthRowMilestone.earned
    });

    const collegium = createRitual({
        name: "Ritual of Collegium",
        visibility: fifthColMilestone.earned
    });

    const celeritas = createRitual({
        name: "Ritual of Celeritas",
        visibility: fifthRowMilestone.earned
    });

    const rituals = {
        doctrina,
        emolumentum,
        melius,
        collegium,
        celeritas
    };

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
    ]) as WithRequired<Modifier, "invert" | "enabled" | "description">;
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
                generators.milestones.timeBatteriesMilestone.earned.value
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
        activeRituals,
        runeRows,
        runeCols,
        rituals,
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
