<template>
    <Tooltip :direction="Direction.Left" display="Open Modifiers" xoffset="10px">
        <div class="modifier-info-toggle">
            <button @click.stop="openModal = true">?</button>
        </div>
    </Tooltip>
    <Modal v-model="openModal" class="modifiers-modal" v-bind="$attrs">
        <template v-slot:header
            ><h2>{{ name }} Modifiers</h2></template
        >
        <template v-slot:body="{ shown }"><component v-if="shown" :is="comp" /></template>
    </Modal>
</template>

<script setup lang="ts">
import { Direction } from "util/common";
import type { ProcessedComputable } from "util/computed";
import { coerceComponent, unwrapRef } from "util/vue";
import type { Component } from "vue";
import { onBeforeUnmount, ref, shallowRef, toRef, watch, watchEffect, WatchStopHandle } from "vue";
import Modal from "../components/Modal.vue";
import type { CoercableComponent } from "./feature";
import Tooltip from "./tooltips/Tooltip.vue";

const props = defineProps<{
    display: ProcessedComputable<CoercableComponent>;
    name: string;
}>();
const display = toRef(props, "display");

const openModal = ref<boolean>(false);

const comp = shallowRef<Component | "">();
let watcher: WatchStopHandle | null = null;

watch(openModal, isOpen => {
    watcher?.();
    if (isOpen) {
        watcher = watchEffect(() => {
            comp.value = coerceComponent(unwrapRef(display));
        });
    } else {
        watcher = null;
    }
});

onBeforeUnmount(() => watcher?.());
</script>

<style scoped>
.modifier-info-toggle button {
    color: var(--feature-foreground);
    background: var(--foreground);
    border: solid 2px var(--feature-foreground);
    border-radius: 50%;
    font-size: 24px;
    line-height: 1;
    margin: 0;
    padding: 0 4.8px;
    cursor: pointer;
}
</style>

<style>
.modifiers-modal .modal-container {
    width: 720px;
}
</style>
