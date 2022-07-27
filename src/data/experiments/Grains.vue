<template>
    <template v-if="Decimal.lt(baseGrains, 1024)">
        <div
            class="grains-container"
            :style="{
                gridTemplateColumns: `repeat(${numCols}, 1fr)`,
                columnGap:
                    numCols === numRows
                        ? 'var(--feature-margin)'
                        : `calc(var(--feature-margin) + ${150 / (numCols - 1)}px)`,
                maxWidth: numCols === numRows ? '300px' : '600px'
            }"
        >
            <Grain
                v-for="index in visibleGrains"
                :key="index"
                :index="index"
                :chippingProgress="chippingProgress"
                :chippingIndex="currentlyChipping"
            />
        </div>
    </template>
    <template v-else>
        <Grain
            :index="0"
            :chippingProgress="chippingProgress"
            :chippingIndex="0"
            class="single-grain"
        />
        <div class="single-grain-label">
            {{ formatWhole(currentlyChipping + 1) }}/{{ formatWhole(visibleGrains) }}
        </div>
    </template>
    <svg style="display: none">
        <filter id="grain-filter">
            <feTurbulence
                x="0"
                y="0"
                width="700px"
                height="700px"
                baseFrequency="0.005"
                numOctaves="10"
                :seed="
                    Decimal.lt(baseGrains, 1024)
                        ? visibleGrains
                        : new Decimal(baseGrains).toNumber()
                "
            ></feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="20" />
        </filter>
    </svg>
</template>

<script setup lang="ts">
import { computed, toRefs } from "vue";
import type { DecimalSource } from "util/bignum";
import Decimal, { formatWhole } from "util/bignum";
import Grain from "./Grain.vue";

const _props = defineProps<{
    baseGrains: DecimalSource;
    chippingProgress: number;
}>();
const { baseGrains, chippingProgress } = toRefs(_props);

// TODO how to handle ridiculous numbers?
const visibleGrains = computed(() =>
    Decimal.pow(2, new Decimal(baseGrains.value).log2().floor()).round().toNumber()
);
const numRows = computed(() =>
    Decimal.pow(2, new Decimal(visibleGrains.value).log2().div(2).floor()).round().toNumber()
);
const numCols = computed(() => Decimal.div(visibleGrains.value, numRows.value).round().toNumber());
const currentlyChipping = computed(() =>
    Decimal.sub(baseGrains.value, visibleGrains.value).add(1).round().toNumber()
);
</script>

<style scoped>
.grains-container {
    display: grid;
    gap: var(--feature-margin);
    height: 300px;
    filter: url(#grain-filter);
    transition-duration: 0s;
}

.single-grain {
    width: 300px;
    height: 300px;
    padding: 0 !important;
    filter: url(#grain-filter);
}

.single-grain-label {
    font-size: xx-large;
    color: var(--highlighted);
    transform: translateY(calc(-150px - 50%));
    margin-bottom: -1em;
}
</style>
