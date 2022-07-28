import Notif from "components/Notif.vue";
import ClickableComponent from "features/clickables/Clickable.vue";
import {
    CoercableComponent,
    Component as ComponentKey,
    GatherProps,
    GenericComponent,
    getUniqueID,
    jsx,
    JSXFunction,
    OptionsFunc,
    Replace,
    setDefault,
    StyleValue,
    Visibility
} from "features/feature";
import { createDismissableNotify } from "game/notifications";
import { DefaultValue, persistent, Persistent } from "game/persistence";
import Decimal, { DecimalSource } from "util/bignum";
import {
    Computable,
    GetComputableType,
    processComputable,
    ProcessedComputable
} from "util/computed";
import { createLazyProxy } from "util/proxies";
import { coerceComponent, VueFeature } from "util/vue";
import { ref, Ref, unref } from "vue";
import "./card.css";

export const metalSymbols = {
    gold: "☉", // Sun, Apollo (healing, arts, knowledge)
    silver: "☽", // Moon, Artemis (nature, childbirth, hunt, young women)
    mercury: "☿", // Mercury, Hermes (communication, commerce, trickery)
    copper: "♀", // Venus, Aphrodite (love, beauty, sexuality)
    iron: "♂", // Mars, Ares (courage, war)
    tin: "♃", // Jupiter, Zeus (sky, lightning, thunder, law, order, justice)
    lead: "♄" // Saturn, Kronos (harvest)
};

export const solarSigns = ["leo", "virgo", "libra", "scorpio", "capricorn", "pisces"];
export const lunarSigns = ["aries", "taurus", "gemini", "cancer", "sagittarius", "aquarius"];

export const signElements = {
    aries: "fire",
    taurus: "earth",
    gemini: "air",
    cancer: "water",
    leo: "fire",
    virgo: "earth",
    libra: "air",
    scorpio: "water",
    sagittarius: "fire",
    capricorn: "earth",
    aquarius: "air",
    pisces: "water"
};

export const CardType = Symbol("Card");

export interface CardActions {
    onPlay?: (level: DecimalSource, isGhost: boolean) => void;
    onNextCardPlay?: (nextCard: GenericCard, isGhost: boolean) => boolean;
}

export interface CardOptions {
    description: Computable<CoercableComponent> | ((level: DecimalSource) => CoercableComponent);
    metal: keyof typeof metalSymbols;
    sign: keyof typeof signElements;
    actions?: CardActions;
    formula?: Computable<CoercableComponent>;
    startingAmount?: number;
    price?: DecimalSource;
    onSelect: VoidFunction;
    shouldNotify: () => boolean;
}

export interface BaseCard {
    id: string;
    amount: Persistent<number>;
    level: Persistent<DecimalSource>;
    display: JSXFunction;
    renderForUpgrade: (showUpgrade: boolean) => JSX.Element;
    renderForDeck: VueFeature;
    renderForShop: JSXFunction;
    renderForPlay: (drawnCards: Ref<number>) => JSX.Element;
    classes: Record<string, boolean>;
    style: StyleValue;
    showNotif: Ref<boolean>;
    type: typeof CardType;
    [ComponentKey]: typeof ClickableComponent;
    [GatherProps]: () => Record<string, unknown>;
}

export type Card<T extends CardOptions> = Replace<
    T & BaseCard,
    {
        description:
            | ProcessedComputable<CoercableComponent>
            | ((level: DecimalSource) => CoercableComponent);
        actions: T["actions"] extends undefined ? Record<string, never> : T["actions"];
        formula: GetComputableType<T["formula"]>;
    }
>;

export type GenericCard = Replace<
    Card<CardOptions>,
    {
        actions: CardActions;
    }
>;

export function createCard<T extends CardOptions>(optionsFunc: OptionsFunc<T, BaseCard>): Card<T> {
    const amount = persistent<number>(0);
    const level = persistent<DecimalSource>(0);
    return createLazyProxy(() => {
        const card = optionsFunc();

        card.id = getUniqueID("card-");
        card.type = CardType;
        card[ComponentKey] = ClickableComponent;

        card.amount = amount;
        card.level = level;
        if (card.startingAmount) {
            amount[DefaultValue] = amount.value = card.startingAmount;
        }

        // TODO make things like card.playComponent, card.shopComponent, etc.
        // that are all VueComponent (same component, unique gather props functions)
        card.display = jsx(() => {
            const genericCard = card as GenericCard;
            const Description = coerceComponent(
                typeof genericCard.description === "function"
                    ? (genericCard.description as (level: DecimalSource) => CoercableComponent)(
                          unref(genericCard.level)
                      )
                    : unref(genericCard.description),
                "h3"
            );
            const Formula = coerceComponent(unref(genericCard.formula) ?? "");
            return (
                <>
                    <Description />
                    <div class="metal">{metalSymbols[genericCard.metal]}</div>
                    {genericCard.formula ? (
                        <div class="formula">
                            <Formula />
                        </div>
                    ) : null}
                </>
            );
        });
        const Display = coerceComponent(card.display);
        const Component = ClickableComponent as GenericComponent;
        const upgradedDisplay = jsx(() => {
            const genericCard = card as GenericCard;
            const Description = coerceComponent(
                typeof genericCard.description === "function"
                    ? (genericCard.description as (level: DecimalSource) => CoercableComponent)(
                          Decimal.add(unref(genericCard.level), 1)
                      )
                    : unref(genericCard.description),
                "h3"
            );
            const Formula = coerceComponent(unref(genericCard.formula) ?? "");
            return (
                <>
                    <Description />
                    <div class="metal">{metalSymbols[genericCard.metal]}</div>
                    {genericCard.formula ? (
                        <div class="formula">
                            <Formula />
                        </div>
                    ) : null}
                </>
            );
        });
        card.renderForUpgrade = showUpgraded => (
            <Component
                id={`${card.id}-upg-${showUpgraded}`}
                {...(card as GenericCard)[GatherProps]()}
                display={showUpgraded ? upgradedDisplay : Display}
                class="big"
                canClick={false}
            />
        );
        card.renderForDeck = {
            [ComponentKey]: Component,
            [GatherProps]: () => ({
                id: `${card.id}-deck`,
                ...(card as GenericCard)[GatherProps](),
                display: jsx(() => (
                    <>
                        <Display />
                        <div class="badge amount">{(card as GenericCard).amount.value}</div>
                        {(card as GenericCard).showNotif.value ? (
                            <Notif style="left: 20px; top: -20px" />
                        ) : null}
                    </>
                )),
                onClick: (card as GenericCard).onSelect
            })
        };
        const displayWithNew = jsx(() => (
            <>
                <Display />
                {(card as GenericCard).amount.value === 0 ? (
                    <div class="badge new">NEW!</div>
                ) : null}
            </>
        ));
        card.renderForShop = jsx(() => {
            const genericCard = card as GenericCard;
            if (genericCard.price == null) {
                return (
                    <Component
                        id={`${card.id}-shop`}
                        {...genericCard[GatherProps]()}
                        class={{ shop: true, hidden: true }}
                        canClick={false}
                    />
                );
            }
            return (
                <Component
                    id={`${card.id}-shop`}
                    {...genericCard[GatherProps]()}
                    class={{ shop: true }}
                    display={displayWithNew}
                    canClick={false}
                />
            );
        });
        const flipping = ref(true);
        let lastCardsDrawn = -1;
        // TODO this is a mess, and will animate on mount
        // Can I fix this with a custom component?
        // TODO speed up animation based on draw time (and devSpeed?)
        card.renderForPlay = cardsDrawn => {
            const genericCard = card as GenericCard;
            const Component = ClickableComponent as GenericComponent;
            if (cardsDrawn.value !== lastCardsDrawn) {
                flipping.value = false;
                requestAnimationFrame(() => (flipping.value = true));
                lastCardsDrawn = cardsDrawn.value;
            }
            return (
                <Component
                    id={`${card.id}-play`}
                    {...genericCard[GatherProps]()}
                    class={{ big: true, playing: true, flipping: flipping.value }}
                    canClick={false}
                />
            );
        };

        processComputable(card as T, "description");
        setDefault(card, "actions", {});
        processComputable(card as T, "formula");

        card.showNotif = createDismissableNotify(
            (card as GenericCard).renderForDeck,
            card.shouldNotify.bind(card)
        );

        card[GatherProps] = function (this: GenericCard) {
            const { id, display, sign } = this;
            return {
                id,
                display,
                visibility: Visibility.Visible,
                classes: {
                    card: true,
                    dontMerge: true,
                    solar: solarSigns.includes(sign),
                    lunar: lunarSigns.includes(sign)
                },
                canClick: true
            };
        };

        return card as unknown as Card<T>;
    });
}
