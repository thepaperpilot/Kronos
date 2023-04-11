<template>
    <div v-if="unref(enabled)">
        <h2
            @click="collapsed.value = !collapsed.value"
            class="breeding-collapsible"
            :class="{ collapsed: collapsed.value }"
        >
            <span class="toggle">▼</span>{{ name }}
        </h2>
        <Column v-if="!collapsed.value">
            <Machine
                v-for="i in new Decimal(machines.amount.value).toNumber()"
                :key="i - 1"
                :index="i - 1"
                :numInputs="numInputs"
                :inputs="unref(inputs)[i - 1] ?? []"
                :timer="unref(timers)[i - 1] ?? 0"
                :duration="duration"
                :outputDisplay="outputDisplay"
                :setInput="setInput"
                :canPowerUp="canPowerUp"
                :poweredUp="
                    poweredUpMachine.value.type === id && i - 1 === poweredUpMachine.value.index
                "
                @setPoweredUp="() => setPoweredUpMachine(i - 1)"
            />
            <component
                :is="(machines as any)[Component]"
                v-bind="(machines as any)[GatherProps]()"
            />
        </Column>
    </div>
</template>

<script setup lang="ts">
import Machine from "./Machine.vue";
import { CoercableComponent } from "features/feature";
import { MachineTypes, OptionalSeed } from "./breeding";
import { Ref, unref } from "vue";
import { ProcessedComputable } from "util/computed";
import Column from "components/layout/Column.vue";
import { GenericRepeatable } from "features/repeatable";
import { Component, GatherProps } from "features/feature";
import Decimal from "util/bignum";

defineProps<{
    id: string;
    name: string;
    enabled: ProcessedComputable<boolean>;
    numInputs: number;
    inputs: Ref<OptionalSeed[][]>;
    timers: Ref<number[]>;
    collapsed: Ref<boolean>;
    machines: GenericRepeatable;
    poweredUpMachine: Ref<{ type: MachineTypes; index: number }>;
    canPowerUp: Ref<boolean>;
    duration: (inputs: OptionalSeed[]) => number;
    outputDisplay: (inputs: OptionalSeed[], machineIndex: number) => CoercableComponent;
    setInput: (machineIndex: number, index: number) => void;
    setPoweredUpMachine: (machineIndex: number) => void;
}>();
</script>

<style>
.breeding-collapsible {
    cursor: pointer;
    width: 100%;
    display: inline-block;
}

.breeding-collapsible .toggle {
    margin-right: 10px;
    display: inline-block;
}

.breeding-collapsible.collapsed .toggle {
    transform: rotate(-90deg);
}
</style>
