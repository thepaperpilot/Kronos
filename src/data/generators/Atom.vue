<template>
    <svg
        width="300"
        height="300"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <g transform="translate(50 50)">
            <g v-for="index in 82" :key="index" :transform="`scale(${getScaleByIndex(index)})`">
                <path
                    d="M0 0L0 -40A40 40 0 0 1 3.061970113459826 -39.88263204734962"
                    class="electron"
                    :transform="`rotate(${getRotation(index)} 0 0)`"
                    :fill="colors[index % 5]"
                />
            </g>
        </g>
    </svg>
</template>

<script setup lang="ts">
import { globalBus } from "game/events";
import { Unsubscribe } from "nanoevents";
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
    speed: number;
}>();

const colors = ["#7E7DFF", "#7290E8", "#89C6FF", "#72CEE8", "#7DFFF9"];
const time = ref(Math.random() * 100000);

let listener: Unsubscribe | null = null;
onMounted(() => {
    listener = globalBus.on("update", diff => {
        time.value = time.value + (props.speed * diff) / 1000;
    });
});
onBeforeUnmount(() => {
    if (listener) {
        listener();
        listener = null;
    }
});

// index starts at 1 and goes to 82
function getScaleByIndex(index: number) {
    if (index <= 2) {
        return 0.168;
    } else if (index <= 10) {
        return 0.333;
    } else if (index <= 28) {
        return 0.5;
    } else if (index <= 60) {
        return 0.667;
    } else if (index <= 78) {
        return 0.833;
    } else {
        return 1;
    }
}

function getRotation(index: number) {
    // Attempting to get animated rotations that don't form patterns / occasional "sync-ups"
    const offset = index ** 2;

    const speed = (index % 2 === 0 ? 1 : -1) * offset;
    const offsetTime = time.value + offset;

    return (speed * offsetTime) % 360;
}
</script>

<style scoped>
.electron {
    transition: all 0.5s, transform 0s;
}
</style>
