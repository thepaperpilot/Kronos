<template>
    <div class="seed feature can" :class="{ selected }" @click="onClick(seed)">
        <Tooltip v-if="seed !== 'none' && seed.analyzed" :display="tooltipDisplay">
            <component v-if="comp" :is="comp" />
            <slot></slot>
        </Tooltip>
        <template v-else>
            <component v-if="comp" :is="comp" />
            <slot></slot>
        </template>
        <div v-if="seed !== 'none' && seed.analyzed" class="analyzed">*</div>
    </div>
</template>

<script setup lang="tsx">
import { jsx } from "features/feature";
import Tooltip from "features/tooltips/Tooltip.vue";
import { formatWhole } from "util/bignum";
import { coerceComponent, computeOptionalComponent, renderJSX } from "util/vue";
import { computed } from "vue";
import breeding, { OptionalSeed } from "./breeding";

const props = defineProps<{
    selected?: boolean;
    seed: OptionalSeed;
    onClick: (currentSeed: OptionalSeed) => void;
}>();

const comp = computeOptionalComponent(
    computed(() =>
        jsx(() => (props.seed === "none" ? "" : renderJSX(breeding.plants[props.seed.type].seed)))
    )
);

const tooltipDisplay = coerceComponent(
    jsx(() =>
        props.seed === "none" || !props.seed.analyzed ? (
            ""
        ) : (
            <>
                Speed: {formatWhole(props.seed.speed)}
                <br />
                Harvest Size: {formatWhole(props.seed.harvest)}
                <br />
                Mutability: {formatWhole(props.seed.mutability)}
            </>
        )
    )
);
</script>

<style>
.seed {
    width: 60px;
    height: 60px;
    flex-shrink: 0;
    flex-grow: 0;
    font-size: xx-large;
    display: inline-flex;
    background: var(--highlighted);
    user-select: none;
    padding: 0px !important;
}

.seed.selected {
    background: var(--bought);
}

.seed .tooltip-container {
    padding: 5px;
    width: calc(100% - 10px);
    height: calc(100% - 10px);
    display: flex;
}

.seed sub {
    position: absolute;
    bottom: 6px;
    right: -2px;
    background: var(--outline);
    border-radius: 50%;
    height: 28px;
    width: 28px;
    line-height: 0px;
    transform: scale(0.65);
    text-align: center;
}

.seed .analyzed {
    position: absolute;
    top: 0;
    right: 4px;
    font-size: medium;
    pointer-events: none;
}
</style>
