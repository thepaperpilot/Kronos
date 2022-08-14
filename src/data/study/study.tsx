/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import Sticky from "components/layout/Sticky.vue";
import Floor from "components/math/Floor.vue";
import Sqrt from "components/math/Sqrt.vue";
import Node from "components/Node.vue";
import Notif from "components/Notif.vue";
import { colorText, createCollapsibleModifierSections } from "data/common";
import experiments from "data/experiments/experiments";
import { main, numJobs } from "data/projEntry";
import { createBar } from "features/bars/bar";
import { CardActions, createCard, GenericCard, signElements } from "features/cards/card";
import { createClickable } from "features/clickables/clickable";
import { jsx, showIf } from "features/feature";
import { createJob } from "features/job/job";
import { createMilestone } from "features/milestones/milestone";
import { createParticles } from "features/particles/particles";
import { createResource, displayResource, trackBest } from "features/resources/resource";
import Resource from "features/resources/Resource.vue";
import { createTab } from "features/tabs/tab";
import { createTabFamily } from "features/tabs/tabFamily";
import { addTooltip } from "features/tooltips/tooltip";
import { BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import { persistent } from "game/persistence";
import player from "game/player";
import settings from "game/settings";
import Decimal, { DecimalSource, format, formatTime, formatWhole } from "util/bignum";
import { Direction, WithRequired } from "util/common";
import { getFirstFeature, render, renderColJSX, renderJSX, renderRow } from "util/vue";
import { computed, ComputedRef, nextTick, ref, unref, watch } from "vue";
import { useToast } from "vue-toastification";
import type { ToastID } from "vue-toastification/dist/types/types";
import distill from "../distill/distill";
import flowers from "../flowers/flowers";
import generators from "../generators/generators";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
import sellParticles from "./sell.json";
import "./study.css";

const toast = useToast();

const id = "study";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Studying";
    const color = "#9b6734";

    const properties = createResource<DecimalSource>(0, "properties");
    const insights = createResource<DecimalSource>(0, "insights");
    const bestInsights = trackBest(insights);
    const timeDrawing = persistent<number>(0);
    const totalCardsDrawn = persistent<number>(0);

    const upgradeNotif = computed(
        () => shopMilestone.earned.value && Object.values(cards).some(c => c.showNotif.value)
    ) as ComputedRef<boolean>;

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "25%",
            y: "20%"
        },
        symbol: "🕮",
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: properties,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(generalTab)),
        visibility: () => showIf(distill.milestones.studyMilestone.earned.value),
        showNotif: upgradeNotif
    }));

    const manualMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 2);
        },
        display: {
            requirement: `Achieve ${job.name} Level 2`,
            effectDisplay: "Unlock drawing cards manually"
        }
    }));
    const shopMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 4);
        },
        display: {
            requirement: `Achieve ${job.name} Level 4`,
            effectDisplay: "Unlock purchasing and selling cards"
        },
        visibility() {
            return showIf(manualMilestone.earned.value);
        }
    }));
    const timeSlotMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 5);
        },
        display: {
            requirement: `Achieve ${job.name} Level 5`,
            effectDisplay: "Unlock a time slot"
        },
        visibility() {
            return showIf(shopMilestone.earned.value);
        }
    }));
    const optimizationsMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 6);
        },
        display: {
            requirement: `Achieve ${job.name} Level 6`,
            effectDisplay: "Unlock optimizations"
        },
        visibility() {
            return showIf(timeSlotMilestone.earned.value);
        }
    }));
    const upgradingMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 8);
        },
        display: {
            requirement: `Achieve ${job.name} Level 8`,
            effectDisplay: "Unlock upgrading cards"
        },
        visibility() {
            return showIf(optimizationsMilestone.earned.value);
        }
    }));
    const jobMilestone = createMilestone(() => ({
        shouldEarn(): boolean {
            return Decimal.gte(job.rawLevel.value, 10);
        },
        display: {
            requirement: `Achieve ${job.name} Level 10`,
            effectDisplay: `Unlock "???" Job`
        },
        visibility() {
            return showIf(upgradingMilestone.earned.value);
        },
        onComplete() {
            // addLayer(generators, player);
        }
    }));
    const milestones = {
        manualMilestone,
        shopMilestone,
        timeSlotMilestone,
        optimizationsMilestone,
        upgradingMilestone,
        jobMilestone
    };
    const orderedMilestones = [
        jobMilestone,
        upgradingMilestone,
        optimizationsMilestone,
        timeSlotMilestone,
        shopMilestone,
        manualMilestone
    ];
    const collapseMilestones = persistent<boolean>(true);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature, collapsedContent, hasCollapsedContent } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    const expOptimization = computed(() =>
        Decimal.pow(1.1, Decimal.max(flowers.bestMoly.value, 1).log10().floor())
    );
    let expOptimizationNotif: ToastID | null = null;
    watch(
        () => formatWhole(Decimal.times(expOptimization.value, 100).sub(100)),
        currLevel => {
            if (settings.active !== player.id) return;
            if (expOptimizationNotif != null) {
                toast.dismiss(expOptimizationNotif);
            }
            expOptimizationNotif = toast.info(
                <>
                    <h3>Experience Optimized!</h3>
                    <div>Experience optimization is now {currLevel}%</div>
                </>
            );
        }
    );
    const expOptimizationBar = createBar(() => ({
        direction: Direction.Right,
        width: 500,
        height: 25,
        progress: () =>
            Decimal.sub(
                1,
                Decimal.add(flowers.bestMoly.value, 1)
                    .log10()
                    .ceil()
                    .sub(Decimal.max(flowers.bestMoly.value, 1).log10())
            ),
        display: jsx(() => <>{format(flowers.bestMoly.value)} best moly</>),
        borderStyle: {
            borderColor: flowers.color,
            color: "#888"
        },
        fillStyle: {
            backgroundColor: flowers.color
        }
    }));
    const studyingOptimization = computed(() =>
        Decimal.pow(1.1, Decimal.max(distill.bestEssentia.value, 1).log10().floor())
    );
    let studyingOptimizationNotif: ToastID | null = null;
    watch(
        () => formatWhole(Decimal.times(studyingOptimization.value, 100).sub(100)),
        currLevel => {
            if (settings.active !== player.id) return;
            if (studyingOptimizationNotif != null) {
                toast.dismiss(studyingOptimizationNotif);
            }
            studyingOptimizationNotif = toast.info(
                <>
                    <h3>{job.name} Optimized!</h3>
                    <div>
                        {job.name} optimization is now {currLevel}%
                    </div>
                </>
            );
        }
    );
    const studyingOptimizationBar = createBar(() => ({
        direction: Direction.Right,
        width: 500,
        height: 25,
        progress: () =>
            Decimal.sub(
                1,
                Decimal.add(distill.bestEssentia.value, 1)
                    .log10()
                    .ceil()
                    .sub(Decimal.max(distill.bestEssentia.value, 1).log10())
            ),
        display: jsx(() => <>{format(distill.bestEssentia.value)} best essentia</>),
        borderStyle: {
            borderColor: distill.color,
            color: "#888"
        },
        fillStyle: {
            backgroundColor: distill.color
        }
    }));
    const drawTimeOptimizaton = computed(() =>
        Decimal.pow(1.1, Decimal.max(bestInsights.value, 1).log10().floor())
    );
    let drawTimeOptimizationNotif: ToastID | null = null;
    watch(
        () => formatWhole(Decimal.times(drawTimeOptimizaton.value, 100).sub(100)),
        currLevel => {
            if (settings.active !== player.id) return;
            if (drawTimeOptimizationNotif != null) {
                toast.dismiss(drawTimeOptimizationNotif);
            }
            drawTimeOptimizationNotif = toast.info(
                <>
                    <h3>Draw Time Optimized!</h3>
                    <div>Draw time optimization is now {currLevel}%</div>
                </>
            );
        }
    );
    const drawTimeOptimizatonBar = createBar(() => ({
        direction: Direction.Right,
        width: 500,
        height: 25,
        progress: () =>
            Decimal.sub(
                1,
                Decimal.add(bestInsights.value, 1)
                    .log10()
                    .ceil()
                    .sub(Decimal.max(bestInsights.value, 1).log10())
            ),
        display: jsx(() => <>{format(bestInsights.value)} best insights</>),
        borderStyle: {
            borderColor: color,
            color: "#888"
        },
        fillStyle: {
            backgroundColor: color
        }
    }));

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
        generators.batteries.study.timePassing.modifier
    ]) as WithRequired<Modifier, "revert" | "enabled" | "description">;
    const computedTimePassing = computed(() => timePassing.apply(1));

    const propertiesGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: jobLevelEffect,
            description: `${job.name} level (x1.1 each)`
        })),
        createMultiplicativeModifier(() => ({
            multiplier: studyingOptimization,
            description: `${job.name} optimization`,
            enabled: optimizationsMilestone.earned
        })),
        generators.batteries.study.resourceGain.modifier
    ]);
    const computedPropertiesGain = computed(() => propertiesGain.apply(10));

    const jobXpGain = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.times(0.01, totalCardsDrawn.value).add(1),
            description: "Drawn cards (+.01x each)"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: expOptimization,
            description: "Experience optimization",
            enabled: optimizationsMilestone.earned
        })),
        generators.batteries.study.xpGain.modifier
    ]);

    const drawTime = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(1, drawTimeOptimizaton.value),
            description: "Draw speed optimization",
            enabled: optimizationsMilestone.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 0.5,
            description: "Faster draw card",
            enabled: () => fasterDrawTime.value > 0
        }))
    ]);
    const computedDrawTime = computed(() => drawTime.apply(10));

    const manualDrawTime = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 0.5,
            description: "Manual bonus"
        }))
    ]);
    const computedManualDrawTime = computed(() => manualDrawTime.apply(computedDrawTime.value));

    const modifiers = {
        timePassing,
        propertiesGain,
        jobXpGain,
        drawTime,
        manualDrawTime
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
            title: "Properties Gain",
            modifier: propertiesGain,
            base: 10
        },
        {
            title: `${job.name} EXP Gain`,
            modifier: jobXpGain,
            base: 1,
            baseText: "Base (per property gained)"
        },
        {
            title: "Automatic Card Draw",
            modifier: drawTime,
            base: 10,
            unit: "s"
        },
        {
            title: "Manual Card Draw",
            modifier: manualDrawTime,
            base: computedDrawTime,
            unit: "s"
        }
    ]);

    const particles = createParticles(() => ({
        fullscreen: false,
        zIndex: -1,
        boundingRect: ref<null | DOMRect>(null),
        onContainerResized(boundingRect) {
            this.boundingRect.value = boundingRect;
        }
    }));

    const totalCards = computed(() =>
        Object.values(cards).reduce((acc, curr) => acc + curr.amount.value, 0)
    ) as ComputedRef<number>;

    const selectedCard = persistent<string>("");
    type BuyableCards =
        | {
              [K in keyof typeof cards]: typeof cards[K] extends { price: DecimalSource }
                  ? K
                  : never;
          }[keyof typeof cards]
        | "";
    const cardShop = persistent<BuyableCards[]>(["", "", ""]);
    const drawnCard = persistent<keyof typeof cards>("nothing");
    const drawnCards = ref<number>(0);

    const nothing = createCard(() => ({
        description: "Do nothing.",
        metal: "mercury",
        sign: "gemini",
        startingAmount: 4,
        onSelect: () => (selectedCard.value = "nothing"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainPoints = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Record{" "}
                    {colorText(
                        formatWhole(
                            Decimal.times(computedPropertiesGain.value, Decimal.add(level, 1))
                        )
                    )}{" "}
                    properties and job exp.
                </h3>
            )),
        metal: "gold",
        sign: "leo",
        actions: {
            onPlay: level => {
                const gain = Decimal.times(computedPropertiesGain.value, Decimal.add(level, 1));
                properties.value = Decimal.add(properties.value, gain);
                job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(gain));
            }
        },
        formula: jsx(() => colorText("properties gain x level")),
        price: 1,
        startingAmount: 4,
        onSelect: () => (selectedCard.value = "gainPoints"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainBigPoints = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Record{" "}
                    {colorText(
                        formatWhole(
                            Decimal.times(computedPropertiesGain.value, Decimal.add(level, 1))
                                .times(10)
                                .pow(1.2)
                        )
                    )}{" "}
                    properties and job exp. Destroy this card.
                </h3>
            )),
        metal: "tin",
        sign: "sagittarius",
        actions: {
            onPlay: (level, isGhost) => {
                const gain = Decimal.times(computedPropertiesGain.value, Decimal.add(level, 1))
                    .times(10)
                    .pow(1.2);
                properties.value = Decimal.add(properties.value, gain);
                job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(gain));
                if (!isGhost) {
                    gainBigPoints.amount.value = Math.max(gainBigPoints.amount.value - 1, 0);
                    if (gainBigPoints.amount.value <= 0 && selectedCard.value === "gainBigPoints") {
                        selectedCard.value = "";
                    }
                }
            }
        },
        formula: jsx(() => (
            <span style="color: var(--accent2)">
                (properties gain x 10 x level)<sup>1.2</sup>
            </span>
        )),
        price: 8,
        onSelect: () => (selectedCard.value = "gainBigPoints"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainInsight = createCard(() => ({
        description: level =>
            Decimal.eq(level, 0)
                ? jsx(() => <h3>Gain {colorText("1")} key insight.</h3>)
                : jsx(() => (
                      <h3>Gain {colorText(formatWhole(Decimal.add(level, 1)))} key insights.</h3>
                  )),
        metal: "copper",
        sign: "libra",
        actions: {
            onPlay: level => {
                insights.value = Decimal.add(insights.value, level).add(1);
            }
        },
        formula: jsx(() => colorText("level")),
        price: 0,
        startingAmount: 2,
        onSelect: () => (selectedCard.value = "gainInsight"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainBigInsight = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Use the size of your deck to gain{" "}
                    {colorText(formatWhole(Decimal.times(totalCards.value, Decimal.add(level, 1))))}{" "}
                    key insights.
                </h3>
            )),
        metal: "silver",
        sign: "cancer",
        actions: {
            onPlay: level => {
                const amount = Decimal.times(totalCards.value, Decimal.add(level, 1));
                insights.value = Decimal.add(insights.value, amount);
            }
        },
        formula: jsx(() => <span style="color: var(--accent2)">cards x level</span>),
        price: 13,
        onSelect: () => (selectedCard.value = "gainBigInsight"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const playTwice = createCard(() => ({
        description: level =>
            Decimal.eq(level, 0)
                ? "Play the next card an extra time (does not stack)"
                : jsx(() => (
                      <h3>
                          Play the next card an extra time, with{" "}
                          {colorText(format(Decimal.div(level, 4)))} bonus levels (does not stack)
                      </h3>
                  )),
        metal: "iron",
        sign: "scorpio",
        actions: {
            onNextCardPlay: nextCard => {
                const onPlay = nextCard.actions.onPlay;
                if (onPlay) {
                    onPlay(
                        Decimal.add(nextCard.level.value, Decimal.div(playTwice.level.value, 4)),
                        true
                    );
                }
                totalCardsDrawn.value++;
                return true;
            }
        },
        formula: jsx(() => colorText("(level - 1) / 4")),
        price: 32,
        onSelect: () => (selectedCard.value = "playTwice"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainXp = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Gain xp equal to {colorText(format(Decimal.div(Decimal.add(level, 1), 10), 1))}x
                    times your number of properties.
                </h3>
            )),
        metal: "tin",
        sign: "pisces",
        actions: {
            onPlay: level => {
                job.xp.value = Decimal.add(
                    job.xp.value,
                    jobXpGain.apply(Decimal.add(level, 1).div(10).times(properties.value))
                );
            }
        },
        formula: jsx(() => colorText("properties x level / 10")),
        price: 25,
        onSelect: () => (selectedCard.value = "gainXp"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const fasterDrawTime = persistent<number>(0);
    const fasterDraws = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Drawing cards is 2x faster for the next{" "}
                    {colorText(formatWhole(Decimal.times(numJobs.value, Decimal.add(level, 1))))}{" "}
                    seconds (doesn't stack)
                </h3>
            )),
        metal: "mercury",
        sign: "virgo",
        actions: {
            onPlay: level =>
                (fasterDrawTime.value = Decimal.times(
                    numJobs.value,
                    Decimal.add(level, 1)
                ).toNumber())
        },
        formula: jsx(() => colorText("number of jobs x level")),
        price: 48,
        onSelect: () => (selectedCard.value = "fasterDraws"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainElementalEssence = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Gain{" "}
                    {colorText(
                        formatWhole(
                            Object.values(main.jobs)
                                .reduce((acc, curr) => acc.add(curr.level.value), new Decimal(0))
                                .sqrt()
                                .floor()
                                .times(Decimal.add(level, 1))
                        )
                    )}{" "}
                    of a random elemental essence
                </h3>
            )),
        metal: "iron",
        sign: "aries",
        actions: {
            onPlay: level => {
                const unlockedElements = Object.values(distill.elements).filter(e =>
                    unref(e.visible)
                );
                const randomElement =
                    unlockedElements[Math.floor(Math.random() * unlockedElements.length)];
                randomElement.resource.value = Decimal.add(
                    randomElement.resource.value,
                    main.sumJobLevels.value.times(Decimal.add(level, 1).sqrt().floor())
                );
            }
        },
        formula: jsx(() => (
            <span style="color: var(--accent2)">
                <Floor>
                    <Sqrt>sum job levels</Sqrt>
                </Floor>{" "}
                x level
            </span>
        )),
        price: 16,
        onSelect: () => (selectedCard.value = "gainElementalEssence"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainInsightFromJobs = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Gain{" "}
                    {colorText(
                        formatWhole(
                            Decimal.times(
                                Object.values(main.jobs).reduce(
                                    (acc, curr) => acc.add(curr.level.value),
                                    new Decimal(0)
                                ),
                                Decimal.add(level, 1)
                            ).floor()
                        )
                    )}{" "}
                    key insights
                </h3>
            )),
        metal: "lead",
        sign: "capricorn",
        actions: {
            onPlay: level => {
                const amount = Decimal.times(
                    Object.values(main.jobs).reduce(
                        (acc, curr) => acc.add(curr.level.value),
                        new Decimal(0)
                    ),
                    Decimal.add(level, 1)
                ).floor();
                insights.value = Decimal.add(insights.value, amount);
            }
        },
        formula: jsx(() => <span style="color: var(--accent2)">sum job levels x level</span>),
        price: 14,
        onSelect: () => (selectedCard.value = "gainInsightFromJobs"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainMolyFromEssentia = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Gain {colorText(formatWhole(Decimal.add(level, 1).times(5)))}s of moly
                    production
                </h3>
            )),
        metal: "lead",
        sign: "aquarius",
        actions: {
            onPlay: level => {
                flowers.flowers.value = Decimal.add(
                    flowers.flowers.value,
                    Decimal.times(
                        flowers.modifiers.flowerGain.apply(0),
                        Decimal.add(1, level).times(5)
                    )
                );
            }
        },
        formula: jsx(() => colorText("5 x level")),
        price: 9,
        onSelect: () => (selectedCard.value = "gainMolyFromEssentia"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const gainPropertiesFromFlowers = createCard(() => ({
        description: level =>
            jsx(() => (
                <h3>
                    Convert half your moly into{" "}
                    {colorText(
                        formatWhole(
                            Decimal.div(flowers.flowers.value, 2)
                                .max(1)
                                .ln()
                                .floor()
                                .times(Decimal.add(1, level))
                                .times(computedPropertiesGain.value)
                        )
                    )}{" "}
                    properties and job exp
                </h3>
            )),
        metal: "copper",
        sign: "taurus",
        actions: {
            onPlay: level => {
                const amount = Decimal.div(flowers.flowers.value, 2)
                    .max(1)
                    .ln()
                    .floor()
                    .times(Decimal.add(1, level))
                    .times(computedPropertiesGain.value);
                flowers.flowers.value = Decimal.div(flowers.flowers.value, 2).floor();
                properties.value = Decimal.add(properties.value, amount);
                job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(amount));
            }
        },
        formula: jsx(() => (
            <span style="color: var(--accent2)">
                properties gain x <Floor>ln(spent moly)</Floor> x level
            </span>
        )),
        price: 8,
        onSelect: () => (selectedCard.value = "gainPropertiesFromFlowers"),
        shouldNotify: function (this: GenericCard) {
            return canUpgrade(this);
        }
    }));
    const cards = {
        nothing,
        gainPoints,
        gainBigPoints,
        gainInsight,
        gainBigInsight,
        playTwice,
        gainXp,
        fasterDraws,
        gainElementalEssence,
        gainInsightFromJobs,
        gainMolyFromEssentia,
        gainPropertiesFromFlowers
    };

    const upgradeCost = computed(() => {
        if (selectedCard.value in cards) {
            const card = cards[selectedCard.value as keyof typeof cards] as GenericCard;
            return new Decimal(10).pow(Decimal.add(card.level.value, 2));
        }
        return 0;
    });
    const upgradeButton = createClickable(() => ({
        display: {
            title: "+1 Level",
            description: jsx(() => {
                if (selectedCard.value in cards) {
                    const card = cards[selectedCard.value as keyof typeof cards] as GenericCard;
                    return (
                        <>
                            Current level: {formatWhole(Decimal.add(card.level.value, 1))}
                            <br />
                            {selectedCard.value === "nothing" ? (
                                <span>Max level!</span>
                            ) : (
                                <span>
                                    Cost: {format(upgradeCost.value)} {insights.displayName}
                                </span>
                            )}
                        </>
                    );
                }
                return "";
            })
        },
        canClick() {
            return (
                selectedCard.value !== "nothing" &&
                selectedCard.value in cards &&
                Decimal.gte(insights.value, upgradeCost.value)
            );
        },
        onClick() {
            if (selectedCard.value in cards) {
                const card = cards[selectedCard.value as keyof typeof cards] as GenericCard;
                insights.value = Decimal.sub(insights.value, upgradeCost.value);
                card.level.value = Decimal.add(card.level.value, 1);
            }
        },
        style: {
            height: "120px",
            alignSelf: "center"
        }
    }));

    const canManualDraw = computed(() =>
        Decimal.gte(timeDrawing.value, computedManualDrawTime.value)
    );
    const drawButton = createClickable(() => ({
        display: {
            title: "Draw",
            description: jsx(() => (
                <>
                    <div>Focus harder in order to discover the next card faster.</div>
                    {canManualDraw.value ? (
                        <div>Available Now!</div>
                    ) : (
                        <div>
                            Available in{" "}
                            {formatTime(
                                Decimal.sub(computedManualDrawTime.value, timeDrawing.value)
                            )}
                        </div>
                    )}
                </>
            ))
        },
        canClick: canManualDraw,
        onClick: drawCard,
        style: {
            minHeight: "50px",
            width: "200px"
        }
    }));

    const soldCards = persistent<number>(0);
    const sellCost = computed(() => Decimal.pow(2, soldCards.value).times(100));
    const sellButton = createClickable(() => ({
        display: {
            title: "Purge card",
            description: jsx(() => (
                <>
                    Remove card from deck
                    <br />
                    Cost: {format(sellCost.value)} {insights.displayName}
                </>
            ))
        },
        canClick() {
            return Decimal.gte(insights.value, sellCost.value);
        },
        async onClick() {
            if (selectedCard.value in cards) {
                const card = cards[selectedCard.value as keyof typeof cards] as GenericCard;
                insights.value = Decimal.sub(insights.value, sellCost.value);
                soldCards.value++;
                card.amount.value--;
                const boundingRect = particles.boundingRect.value;
                const rect = layer.nodes.value.deck?.rect;
                if (boundingRect && rect) {
                    await nextTick();
                    particles.addEmitter(sellParticles).then(e => {
                        e.updateOwnerPos(
                            rect.x + rect.width / 2 - boundingRect.x,
                            rect.y + rect.height / 2 - boundingRect.y
                        );
                        e.playOnceAndDestroy();
                    });
                }
                if (card.amount.value <= 0) {
                    selectedCard.value = "";
                }
            }
        },
        style: {
            "--layer-color": "var(--danger)",
            minHeight: "50px",
            width: "200px"
        }
    }));

    const buyButtons = new Array(3).fill(0).map((_, i) => {
        const buyButton = createClickable(() => ({
            display: {
                title: "Purchase Card",
                description: jsx(() => {
                    const cardKey = cardShop.value[i];
                    if (cardKey === "") {
                        return (
                            <>
                                Out of Stock!
                                <div class="element-cost"></div>
                            </>
                        );
                    }
                    const card = cards[cardKey];
                    const element = signElements[card.sign] as "fire" | "earth" | "air" | "water";
                    return (
                        <>
                            {formatWhole(card.price)} {element} essence
                            <div
                                class="element-cost"
                                style={{ color: distill.elements[element].color }}
                            >
                                {distill.elements[element].symbol}
                            </div>
                        </>
                    );
                })
            },
            canClick() {
                const cardKey = cardShop.value[i];
                if (cardKey === "") {
                    return false;
                }
                const card = cards[cardKey];
                const element = signElements[card.sign] as "fire" | "earth" | "air" | "water";
                const baseResource = distill.elements[element].resource;
                return Decimal.gte(baseResource.value, card.price);
            },
            onClick() {
                const cardKey = cardShop.value[i];
                if (cardKey === "") {
                    return false;
                }
                const card = cards[cardKey];
                const element = signElements[card.sign] as "fire" | "earth" | "air" | "water";
                const baseResource = distill.elements[element].resource;
                card.amount.value += 1;
                baseResource.value = Decimal.sub(baseResource.value, card.price);
                cardShop.value[i] = "";
            },
            style: {
                width: "165px",
                margin: "20px 7.5px",
                minHeight: "50px",
                paddingLeft: "55px",
                borderTopLeftRadius: "25px",
                borderBottomLeftRadius: "25px"
            }
        }));
        addTooltip(buyButton, {
            display: jsx(() => {
                const cardKey = cardShop.value[i];
                if (cardKey === "") {
                    return <></>;
                }
                const card = cards[cardKey];
                const element = signElements[card.sign] as "fire" | "earth" | "air" | "water";
                const baseResource = distill.elements[element].resource;
                return (
                    <>
                        You have {displayResource(baseResource)} {baseResource.displayName}
                    </>
                );
            }),
            direction: Direction.Down
        });
        return buyButton;
    });

    const cardsDrawnToShop = persistent<number>(0);
    const cardsDrawnPerRefresh = computed(() => 7);

    function drawCard() {
        timeDrawing.value = 0;
        drawnCards.value++;
        cardsDrawnToShop.value++;
        totalCardsDrawn.value++;

        const prevCard = drawnCard.value;
        let draw = Math.floor(Math.random() * totalCards.value);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        drawnCard.value = (Object.keys(cards) as (keyof typeof cards)[]).find(key => {
            if (draw <= cards[key].amount.value) {
                return true;
            }
            draw -= cards[key].amount.value;
            return false;
        })!;

        if (
            (cards[prevCard].actions as CardActions).onNextCardPlay?.(
                cards[drawnCard.value] as GenericCard,
                false
            ) ??
            true
        ) {
            (cards[drawnCard.value].actions as CardActions).onPlay?.(
                cards[drawnCard.value].level.value,
                false
            );
        }

        if (cardsDrawnToShop.value >= cardsDrawnPerRefresh.value) {
            cardsDrawnToShop.value = 0;
            const buyableCards = (Object.keys(cards) as (keyof typeof cards)[]).filter(
                c => "price" in cards[c]
            ) as BuyableCards[];
            cardShop.value = new Array(3)
                .fill(0)
                .map(() => buyableCards[Math.floor(Math.random() * buyableCards.length)]);
        }
    }

    function canUpgrade(c: GenericCard) {
        return (
            shopMilestone.earned.value &&
            c.amount.value > 0 &&
            Decimal.gte(insights.value, new Decimal(10).pow(Decimal.add(c.level.value, 2)))
        );
    }

    this.on("preUpdate", diff => {
        if (!job.active.value) return;

        diff = Decimal.times(diff, computedTimePassing.value).toNumber();

        timeDrawing.value += diff;
        fasterDrawTime.value = Math.max(0, fasterDrawTime.value - diff);

        if (Decimal.gte(timeDrawing.value, computedDrawTime.value)) {
            drawCard();
        }
    });

    const tabs = createTabFamily(
        {
            play: () => ({
                display: "Play",
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            {cards[drawnCard.value].renderForPlay(drawnCards)}
                            {manualMilestone.earned.value ? renderRow(drawButton) : null}
                            {shopMilestone.earned.value ? (
                                <div>
                                    Shop will refresh in{" "}
                                    {cardsDrawnPerRefresh.value - cardsDrawnToShop.value} draws
                                </div>
                            ) : null}
                            <Spacer />
                            <div>
                                Card will be drawn automatically in{" "}
                                {formatTime(Decimal.sub(computedDrawTime.value, timeDrawing.value))}
                            </div>
                        </>
                    ))
                })),
                style: {
                    borderLeft: "5px solid var(--outline)",
                    marginLeft: "5px"
                }
            }),
            deck: () => ({
                display: jsx(() => (
                    <span style="position: relative;">
                        Cards{upgradeNotif.value ? <Notif style="left: -15px; top: -10px" /> : null}
                    </span>
                )),
                tab: createTab(() => ({
                    display: jsx(() => {
                        const ownedCards = (Object.values(cards) as GenericCard[]).filter(
                            c => c.amount.value > 0
                        );
                        const deckRows = Math.ceil(ownedCards.length / 5);
                        return (
                            <>
                                <Spacer />
                                {shopMilestone.earned.value ? (
                                    <>
                                        <h2>Shop</h2>
                                        <Spacer />
                                        {cardShop.value.map(c =>
                                            c === ""
                                                ? cards.nothing.renderForShop()
                                                : cards[c].renderForShop()
                                        )}
                                        {renderRow(...buyButtons)}
                                        <div>
                                            Shop will refresh in{" "}
                                            {cardsDrawnPerRefresh.value - cardsDrawnToShop.value}{" "}
                                            draws
                                        </div>
                                        <Spacer height="50px" />
                                    </>
                                ) : null}
                                <h2>Deck</h2>
                                <Spacer />
                                <div class="cardDeck-container">
                                    <Node id="deck" />
                                    {...new Array(deckRows)
                                        .fill(0)
                                        .map((_, i) =>
                                            renderRow(
                                                ...ownedCards
                                                    .slice(
                                                        i * Math.ceil(ownedCards.length / deckRows),
                                                        (i + 1) *
                                                            Math.ceil(ownedCards.length / deckRows)
                                                    )
                                                    .map(c => c.renderForDeck)
                                            )
                                        )}
                                </div>
                                <Spacer />
                                {selectedCard.value ? (
                                    <>
                                        {upgradingMilestone.earned.value ? (
                                            <div style="display: flex; justify-content: center;">
                                                {cards[
                                                    selectedCard.value as keyof typeof cards
                                                ].renderForUpgrade(false)}
                                                <div style="display: flex; flex-direction: column; color: var(--layer-color); font-size: xxx-large; margin-left: -30px; margin-right: -30px">
                                                    <span style="margin-bottom: 20px">
                                                        &#62;&#62;&#62;
                                                    </span>
                                                    {render(upgradeButton)}
                                                    <span style="margin-top: 20px">
                                                        &#62;&#62;&#62;
                                                    </span>
                                                </div>
                                                {cards[
                                                    selectedCard.value as keyof typeof cards
                                                ].renderForUpgrade(true)}
                                            </div>
                                        ) : (
                                            cards[
                                                selectedCard.value as keyof typeof cards
                                            ].renderForUpgrade(false)
                                        )}
                                        {shopMilestone.earned.value ? render(sellButton) : null}
                                    </>
                                ) : null}
                            </>
                        );
                    })
                }))
            }),
            optimizations: () => ({
                display: "Optimizations",
                visibility: () => showIf(optimizationsMilestone.earned.value),
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <Spacer />
                            <h2>Experience Optimization</h2>
                            <div style="margin: 20px">
                                The magnitude of your best moly amount has allowed you to optimize
                                your exp gain by{" "}
                                {formatWhole(Decimal.times(expOptimization.value, 100).sub(100))}
                                %.
                                <br />
                                Each additional order of magnitude gives a compounding 10%
                                optimization.
                            </div>
                            {render(expOptimizationBar)}
                            <Spacer height="50px" />
                            <h2>{job.name} Optimization</h2>
                            <div style="margin: 20px">
                                The magnitude of your best essentia amount has allowed you to
                                optimize your properties gain by{" "}
                                {formatWhole(
                                    Decimal.times(studyingOptimization.value, 100).sub(100)
                                )}
                                %.
                                <br />
                                Each additional order of magnitude gives a compounding 10%
                                optimization.
                            </div>
                            {render(studyingOptimizationBar)}
                            <Spacer height="50px" />
                            <h2>Draw Speed Optimization</h2>
                            <div style="margin: 20px">
                                The magnitude of your best insights amount has allowed you to
                                optimize your drawing speed by{" "}
                                {formatWhole(
                                    Decimal.times(drawTimeOptimizaton.value, 100).sub(100)
                                )}
                                %.
                                <br />
                                Each additional order of magnitude gives a compounding 10%
                                optimization.
                            </div>
                            {render(drawTimeOptimizatonBar)}
                        </>
                    ))
                }))
            })
        },
        () => ({
            classes: {
                floating: false
            },
            style: {
                borderStyle: "none",
                marginLeft: "-20px",
                marginRight: "-20px"
            },
            buttonContainerStyle: {
                top: "50px"
            }
        })
    );

    return {
        name,
        color,
        minWidth: 670,
        properties,
        insights,
        bestInsights,
        timeDrawing,
        job,
        cards,
        modifiers,
        milestones,
        collapseMilestones,
        generalTabCollapsed,
        tabs,
        selectedCard,
        drawnCard,
        soldCards,
        cardShop,
        cardsDrawnToShop,
        fasterDrawTime,
        totalCardsDrawn,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstFeature.value) {
                milestonesToDisplay.push(firstFeature.value);
            }
            return (
                <>
                    <Sticky>
                        <div style="height: 50px; line-height: 50px; margin-bottom: 20px">
                            You have <Resource resource={properties} color={color} /> properties
                            studied and <Resource resource={insights} color="darkcyan" /> key
                            insights
                        </div>
                    </Sticky>
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
                    {render(particles)}
                </>
            );
        })
    };
});

export default layer;
