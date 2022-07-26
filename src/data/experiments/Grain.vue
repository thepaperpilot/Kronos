<template>
    <div class="grain not-started" v-if="chippingIndex < index" :class="{}" />
    <div class="grain complete" v-else>
        <div
            class="grain"
            v-if="chippingIndex === index"
            :style="{
                clipPath: `polygon(0 0, 100% 0, 100% ${(1 - chippingProgress) * 100}%, 0 ${
                    (1 - chippingProgress) * 100
                }%)`
            }"
        />
    </div>
</template>

<script setup lang="ts">
import { toRefs } from "vue";

const _props = defineProps<{
    index: number;
    chippingProgress: number;
    chippingIndex: number;
}>();
const { index, chippingProgress, chippingIndex } = toRefs(_props);
</script>

<style scoped>
.grain {
    aspect-ratio: 1;
    background-color: white;
    border-radius: 50%;
    transition-duration: 0s;
}

.grain.complete,
.grain.not-started {
    position: relative;
    padding-left: 100%;
    padding-bottom: 100%;
}

.grain:not(.complete):not(.not-started) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.complete {
    background-color: rgba(0, 0, 0, 0.3);
}
</style>
