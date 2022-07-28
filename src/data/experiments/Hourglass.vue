<template>
    <div
        class="hourglass-container"
        :class="{ flipping: flippingProgress < 1 }"
        @click="emit('flip')"
    >
        <Notif v-if="showHourglassNotif" />
        <svg
            width="240"
            height="312"
            viewBox="0 0 300 390"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            :style="{
                transform: `rotateZ(${(1 - flippingProgress) * 180}deg)`
            }"
        >
            <defs>
                <clipPath id="glass-mask">
                    <path
                        d="M204 -2.82683e-05L10 -2.83344e-05C-38 50 103 95.3005 103 175C103 254.699 -38 300 10 350H204C252 300 111 254.699 111 175C111 95.3005 252 50 204 -2.82683e-05Z"
                        fill="black"
                    />
                </clipPath>
                <clipPath id="sand-top-mask">
                    <path
                        d="M149.25 19.5C89.9195 19.5 0.5 0.5 0.5 0.5V390H299.5V0.5C299.5 0.5 208.581 19.5 149.25 19.5Z"
                        :transform="
                            flippingProgress < 1
                                ? `translate(0, ${-40 + flippingProgress * 40})`
                                : `translate(0, ${Decimal.div(grainsFallen, totalGrains)
                                      .sqr()
                                      .times(190)
                                      .toNumber()})`
                        "
                        fill="black"
                    />
                </clipPath>
                <clipPath id="sand-bottom-mask">
                    <path
                        d="M148.75 0C89.4195 0 0 19 0 19V389.5H299V19C299 19 208.081 0 148.75 0Z"
                        :transform="`translate(-40, ${Decimal.sub(
                            350,
                            Decimal.div(grainsFallen, totalGrains).sqr().times(150)
                        ).toNumber()})`"
                        fill="black"
                    />
                </clipPath>
                <clipPath id="flipping-mask">
                    <path
                        d="M150.25 389.5C209.581 389.5 300 370.5 300 370.5L300 3.05176e-05L1.87924e-05 4.37817e-06L-1.35978e-05 370.5C-1.35978e-05 370.5 90.9194 389.5 150.25 389.5Z"
                        fill="black"
                        :transform="`translate(0, ${Math.max(flippingProgress, 0.5) * 420 - 445})`"
                    />
                </clipPath>
            </defs>
            <g id="sand" transform="translate(42, 20)" clip-path="url(#glass-mask)">
                <g clip-path="url(#flipping-mask)">
                    <path
                        id="sand-top"
                        d="M204 -2.82683e-05L10 -2.83344e-05C-38 50 103 95.3005 103 175V350H111V175C111 95.3005 252 50 204 -2.82683e-05Z"
                        fill="white"
                        clip-path="url(#sand-top-mask)"
                    />
                </g>
                <rect
                    id="sand-bottom"
                    width="300"
                    height="390"
                    fill="white"
                    clip-path="url(#sand-bottom-mask)"
                />
            </g>
            <path
                id="glass"
                transform="translate(38, 20)"
                d="M212 -2.82683e-05L10 -2.83344e-05C-38 50 103 95.3005 103 175C103 254.699 -38 300 10 350H212C260 300 119 254.699 119 175C119 95.3005 260 50 212 -2.82683e-05Z"
                fill="#0003"
            />
            <path
                id="frame"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M300 0H0V20H300V0ZM300 370H0V390H300V370Z"
                fill="#9E9169"
            />
            <path
                id="sides"
                transform="translate(15, 20)"
                d="M20 0H0V350H20V0ZM270 0H250V350H270V0Z"
                fill="#817654"
            />
        </svg>
        <div class="remainingGrains" v-if="Decimal.sub(totalGrains, grainsFallen).gt(0)">
            {{ formatWhole(Decimal.sub(totalGrains, grainsFallen)) }}
        </div>
        <div v-else class="flip-request">
            Press to <br />
            flip
        </div>
        <div class="fallenGrains">{{ formatWhole(grainsFallen) }}</div>
    </div>
</template>

<script setup lang="ts">
import { toRefs } from "vue";
import type { DecimalSource } from "util/bignum";
import Decimal, { formatWhole } from "util/bignum";
import Notif from "components/Notif.vue";

const _props = defineProps<{
    totalGrains: DecimalSource;
    grainsFallen: DecimalSource;
    flippingProgress: number;
    showHourglassNotif: boolean;
}>();
const { totalGrains, grainsFallen } = toRefs(_props);

const emit = defineEmits<{
    (event: "flip"): void;
}>();
</script>

<style scoped>
.hourglass-container {
    position: relative;
    display: inline-block;
}

.hourglass-container svg,
.hourglass-container svg * {
    transition-duration: 0s;
}

.remainingGrains,
.flip-request,
.fallenGrains {
    position: absolute;
    left: 50%;
    color: var(--highlighted);
    font-weight: bolder;
    font-size: x-large;
    cursor: default;
}

.remainingGrains {
    top: 12.5%;
    transform: translate(-50%, -50%);
}

.flip-request {
    top: 20%;
    transform: translate(-50%, -50%);
}

.fallenGrains {
    bottom: 12.5%;
    transform: translate(-50%, 50%);
}

.flipping .remainingGrains,
.flipping .flip-request,
.flipping .fallenGrains {
    opacity: 0;
    transition-duration: 0s;
}
</style>
