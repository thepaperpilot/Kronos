<template>
    <div class="plant feature">
        <div class="plant-info" :style="{ color }">
            <span class="plant-symbol">
                {{ symbol }}
            </span>
            <div class="plant-details">
                <span>{{ name }}</span>
                <span>Stored: {{ formatWhole(unref(amount)) }}</span>
            </div>
            <div style="flex-grow: 1"></div>
            <button class="button" @click="consume">
                <h3>Consume</h3>
                <br />{{ buttonText }}
            </button>
        </div>
        <div v-if="Decimal.gt(unref(consumedTimeRemaining), 0)">
            Current bonus: {{ format(unref(multiplier)) }}x {{ effectDescription }} for
            {{ formatTime(unref(consumedTimeRemaining)) }}
        </div>
    </div>
</template>

<script setup lang="ts">
import Decimal, { DecimalSource, format, formatTime, formatWhole } from "util/bignum";
import { computed, Ref, unref } from "vue";

const props = defineProps<{
    name: string;
    symbol: string;
    color: string;
    effectDescription: string;
    amount: Ref<DecimalSource>;
    consumedTimeRemaining: Ref<DecimalSource>;
    multiplier: Ref<DecimalSource>;
    consume: VoidFunction;
}>();

const buttonText = computed(
    () =>
        `${format(Decimal.add(props.amount.value, 1).log10().add(1))}x ${
            props.effectDescription
        } for ${formatTime(Decimal.pow(props.amount.value, 2).add(1).log2())}`
);
</script>

<style>
.plant {
    background: var(--raised-background);
    margin-left: 0 !important;
    margin-right: 0 !important;
    width: 100%;
}

.plant-info {
    display: flex;
}

.plant-symbol {
    flex: 0 1 10px;
    margin: var(--feature-margin);
    font-size: xxx-large;
}

.plant-details {
    display: flex;
    flex-direction: column;
    text-align: left;
    margin: var(--feature-margin);
    justify-content: center;
}

.plant-details > span {
    margin: 0;
}

.plant button {
    background-color: var(--layer-color);
    width: 50%;
}
</style>
