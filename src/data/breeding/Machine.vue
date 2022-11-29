<template>
    <div
        class="machine feature"
        :class="{ poweredUp, canPowerUp: !poweredUp && unref(canPowerUp) }"
    >
        <div class="inputs">
            <SeedSlot
                v-for="i in numInputs"
                :key="i - 1"
                :seed="inputs[i - 1] ?? 'none'"
                :onClick="() => setInput(index, i - 1)"
            />
        </div>
        <svg
            width="208"
            height="58"
            viewBox="0 0 208 58"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            @click="emit('setPoweredUp')"
        >
            <path
                d="M4 29C15.1929 16.5 26.3858 4 54 4C109.228 4 98.7715 54 154 54C181.614 54 192.807 41.5 204 29"
                stroke="grey"
                stroke-width="7"
                stroke-linecap="round"
            />
            <path
                d="M4 29C15.1929 16.5 26.3858 4 54 4C109.228 4 98.7715 54 154 54C181.614 54 192.807 41.5 204 29"
                stroke="black"
                stroke-width="7"
                stroke-linecap="round"
                class="progress"
                :style="{
                    strokeDashoffset: `calc(var(--dash-length) * ${Decimal.sub(
                        0.33,
                        Decimal.div(timer, duration(inputs)).times(1.33)
                    ).toNumber()})`
                }"
            />
        </svg>
        <component v-if="comp" :is="comp" />
        <Notif v-if="shouldNotify" />
    </div>
</template>

<script setup lang="ts">
import { CoercableComponent } from "features/feature";
import Decimal from "util/bignum";
import { coerceComponent } from "util/vue";
import { computed, Ref, shallowRef, unref, watchEffect } from "vue";
import type { Component } from "vue";
import { OptionalSeed } from "./breeding";
import SeedSlot from "./SeedSlot.vue";
import Notif from "components/Notif.vue";

const props = defineProps<{
    index: number;
    numInputs: number;
    inputs: OptionalSeed[];
    timer: number;
    poweredUp: boolean;
    canPowerUp: Ref<boolean>;
    duration: (inputs: OptionalSeed[]) => number;
    outputDisplay: (inputs: OptionalSeed[], machineIndex: number) => CoercableComponent;
    setInput: (machineIndex: number, index: number) => void;
}>();

const emit = defineEmits<{
    (event: "setPoweredUp"): void;
}>();

const comp = shallowRef<Component | "">();
watchEffect(() => {
    comp.value = coerceComponent(props.outputDisplay(props.inputs, props.index));
});

const shouldNotify = computed(
    () => props.numInputs !== props.inputs.filter(seed => seed != null && seed !== "none").length
);
</script>

<style>
.machine {
    background: var(--raised-background);
    width: 600px;
    display: flex;
}

.machine.canPowerUp {
    cursor: pointer;
}

.machine > * {
    flex-basis: 50%;
}

.machine .inputs {
    flex-basis: 0;
}

.machine .progress {
    --dash-length: 234.6017608642578px;
    stroke-dasharray: calc(234.6017608642578 / 3) 234.6017608642578;
    transition-duration: 0s;
}

.machine.poweredUp .progress {
    stroke: var(--layer-color);
}
</style>
