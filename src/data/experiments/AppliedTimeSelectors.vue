<template>
    <div class="applied-time-selectors-container">
        <div
            v-for="(job, id, index) in visibleJobs"
            :key="id"
            class="feature can dontMerge applied-time-selector"
            :class="selectedJob === id ? 'selected' : ''"
            :style="{
                backgroundColor: unref(job.color),
                top: `${Math.sin(index * arc + player.time / 10000) * 200 + 300}px`,
                left: `${Math.cos(index * arc + player.time / 10000) * 200 + 300}px`
            }"
            @click="emit('selectJob', id)"
        >
            <div class="applied-time-symbol" v-if="unref(job.symbol).length <= 2">
                {{ job.symbol }}
            </div>
            <span class="applied-time-symbol material-icons" v-else>{{ job.symbol }}</span>
        </div>
        <div class="applied-time-effect">{{ format(effect) }}x</div>
    </div>
</template>

<script setup lang="ts">
import { computed, toRefs, unref } from "vue";
import type { DecimalSource } from "util/bignum";
import { format } from "util/bignum";
import { GenericJob } from "features/job/job";
import { Visibility } from "features/feature";
import player from "game/player";

const _props = defineProps<{
    jobs: Record<string, GenericJob>;
    selectedJob: string;
    effect: DecimalSource;
}>();
const { jobs, selectedJob, effect } = toRefs(_props);

const emit = defineEmits<{
    (event: "selectJob", job: string): void;
}>();

const visibleJobs = computed(() =>
    Object.keys(jobs.value)
        .filter(j => unref(jobs.value[j].visibility) === Visibility.Visible)
        .reduce(
            (acc, curr) => ({ ...acc, [curr]: jobs.value[curr] }),
            {} as Record<string, GenericJob>
        )
);

const arc = computed(() => (Math.PI * 2) / Object.keys(visibleJobs.value).length);
</script>

<style scoped>
.applied-time-selectors-container {
    position: relative;
    width: 600px;
    height: 600px;
}

.applied-time-selector {
    position: absolute;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    width: 100px;
    height: 100px;
    transition: all 0.5s, z-index 0s, top 0s, left 0s;
}

.applied-time-selector.selected {
    transform: translate(-50%, -50%) scale(1.15, 1.15);
    box-shadow: 0 0 20px var(--points);
}

.applied-time-symbol {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 50px;
}

.applied-time-effect {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 50px;
}
</style>
