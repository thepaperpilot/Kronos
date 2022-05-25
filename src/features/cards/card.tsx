import ClickableComponent from "features/clickables/Clickable.vue";
import {
    CoercableComponent,
    Component,
    GatherProps,
    GenericComponent,
    getUniqueID,
    jsx,
    JSXFunction,
    OptionsFunc,
    Replace,
    setDefault
} from "features/feature";
import { Resource } from "features/resources/resource";
import { DefaultValue, persistent, Persistent } from "game/persistence";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import {
    Computable,
    GetComputableType,
    processComputable,
    ProcessedComputable
} from "util/computed";
import { createLazyProxy } from "util/proxies";
import { coerceComponent } from "util/vue";
import { unref } from "vue";
import "./cards.css";

export const metalSymbols = {
    gold: "☉", // Sun, Apollo (healing, arts, knowledge)
    silver: "☽", // Moon, Artemis (nature, childbirth, hunt, young women)
    mercury: "☿", // Mercury, Hermes (communication, commerce, trickery)
    copper: "♀", // Venus, Aphrodite (love, beauty, sexuality)
    iron: "♂", // Mars, Ares (courage, war)
    tin: "♃", // Jupiter, Zeus (sky, lightning, thunder, law, order, justice)
    lead: "♄" // Saturn, Kronos (harvest)
};

export const CardType = Symbol("Card");

export interface CardActions {
    onPlay?: (level: DecimalSource, isGhost: boolean) => void;
    onNextCardPlay?: (nextCard: GenericCard, isGhost: boolean) => void;
}

export interface CardOptions {
    description: Computable<CoercableComponent> | ((level: DecimalSource) => CoercableComponent);
    metal: keyof typeof metalSymbols;
    actions?: CardActions;
    formula?: Computable<CoercableComponent>;
    startingAmount?: number;
    price?: DecimalSource;
    resource?: Resource;
}

export interface BaseCard {
    id: string;
    amount: Persistent<number>;
    level: Persistent<DecimalSource>;
    display: JSXFunction;
    renderForUpgrade: JSXFunction;
    renderForDeck: JSXFunction;
    renderForShop: JSXFunction;
    type: typeof CardType;
    [Component]: typeof ClickableComponent;
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

        if ((card.price == null) != (card.resource == null)) {
            console.warn(
                "Cannot create card with only a price or resource. The card must have neither or both.",
                card
            );
            throw "Cannot create card with only a price or resource. The card must have neither or both.";
        }

        card.id = getUniqueID("card-");
        card.type = CardType;
        card[Component] = ClickableComponent;

        card.amount = amount;
        card.level = level;
        if (card.startingAmount) {
            amount[DefaultValue] = amount.value = card.startingAmount;
        }

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
                    <div class="metal">{genericCard.metal}</div>
                    {genericCard.formula ? (
                        <div class="formula">
                            <Formula />
                        </div>
                    ) : null}
                </>
            );
        });
        card.renderForUpgrade = jsx(() => {
            const genericCard = card as GenericCard;
            const Description = coerceComponent(
                typeof genericCard.description === "function"
                    ? (genericCard.description as (level: DecimalSource) => CoercableComponent)(
                          Decimal.add(genericCard.level.value, 1)
                      )
                    : unref(genericCard.description),
                "h3"
            );
            const Formula = coerceComponent(unref(genericCard.formula) ?? "");
            const display = jsx(() => (
                <>
                    <Description />
                    <div class="metal">{genericCard.metal}</div>
                    {genericCard.formula ? (
                        <div class="formula">
                            <Formula />
                        </div>
                    ) : null}
                </>
            ));
            const Component = ClickableComponent as GenericComponent;
            return <Component {...genericCard[GatherProps]()} display={display} />;
        });
        card.renderForDeck = jsx(() => {
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
            const display = jsx(() => (
                <>
                    <Description />
                    <div class="amount">{genericCard.amount.value}</div>
                    <div class="metal">{genericCard.metal}</div>
                    {genericCard.formula ? (
                        <div class="formula">
                            <Formula />
                        </div>
                    ) : null}
                </>
            ));
            const Component = ClickableComponent as GenericComponent;
            // TODO onClick to select card
            return <Component {...genericCard[GatherProps]()} display={display} />;
        });
        card.renderForShop = jsx(() => {
            const genericCard = card as GenericCard;
            const canClick =
                genericCard.price != null &&
                genericCard.resource != null &&
                Decimal.gt(genericCard.resource.value, genericCard.price);
            const onClick = function () {
                if (canClick) {
                    genericCard.resource!.value = Decimal.sub(
                        genericCard.resource!.value,
                        genericCard.price!
                    );
                    genericCard.amount.value++;
                    // TODO visual feedback / disabling the card?
                }
            };
            const Display = coerceComponent(genericCard.display);
            const display = jsx(() => (
                <>
                    <Display />
                    <div class="amount">
                        {genericCard.amount.value === 0 ? "NEW" : genericCard.amount.value}
                    </div>
                    <div class="cost">{formatWhole(genericCard.price ?? 0)}</div>
                </>
            ));
            const Component = ClickableComponent as GenericComponent;
            return (
                <Component
                    {...genericCard[GatherProps]()}
                    display={display}
                    canClick={canClick}
                    onClick={onClick}
                />
            );
        });

        processComputable(card as T, "description");
        setDefault(card, "actions", {});
        processComputable(card as T, "formula");

        card[GatherProps] = function (this: GenericCard) {
            const { id, display } = this;
            return {
                id,
                display,
                visibility: true,
                classes: { card: true },
                canClick: true
            };
        };

        return card as unknown as Card<T>;
    });
}
