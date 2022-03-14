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
import { formatWhole } from "util/break_eternity";
import { renderCol, renderRow } from "util/vue";
import { computed, Ref } from "vue";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
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
        return createClickable(() => ({
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
