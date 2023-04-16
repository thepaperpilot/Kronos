/**
 * @module
 * @hidden
 */

import Collapsible from "components/layout/Collapsible.vue";
import Spacer from "components/layout/Spacer.vue";
import { createCollapsibleModifierSections } from "data/common";
import experiments from "data/experiments/experiments";
import {
    CoercableComponent,
    Component,
    GatherProps,
    GenericComponent,
    jsx
} from "features/feature";
import { createJob } from "features/job/job";
import { createAchievement, GenericAchievement } from "features/achievements/achievement";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createTabFamily } from "features/tabs/tabFamily";
import { addLayer, BaseLayer, createLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier, Modifier } from "game/modifiers";
import { persistent, State } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource, formatWhole } from "util/bignum";
import type { WithRequired } from "util/common";
import {
    coerceComponent,
    getFirstFeature,
    render,
    renderCol,
    renderColJSX,
    renderJSX,
    VueFeature
} from "util/vue";
import { computed, ComputedRef, Ref, unref, watch } from "vue";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";
import study from "data/study/study";
import generators from "data/generators/generators";
import { createResource } from "features/resources/resource";
import rituals from "data/rituals/rituals";
import { createLazyProxy } from "util/proxies";
import { Computable, convertComputable, ProcessedComputable } from "util/computed";
import MachineType from "./MachineType.vue";
import Plant from "./Plant.vue";
import SeedSlot from "./SeedSlot.vue";
import flowers from "data/flowers/flowers";
import distill from "data/distill/distill";
import { globalBus } from "game/events";
import { createRepeatable, GenericRepeatable } from "features/repeatable";
import { createBooleanRequirement, createCostRequirement } from "game/requirements";
import Formula from "game/formulas/formulas";

export type SeedTypes =
    | "moly"
    | "earthEssence"
    | "waterEssence"
    | "airEssence"
    | "fireEssence"
    | "properties"
    | "potentia"
    | "energeia";

export type MachineTypes =
    | "growMachines"
    | "breedingMachines"
    | "analyzingMachines"
    | "recyclingMachines"
    | "mutatingMachines";

export interface Seed {
    type: SeedTypes;
    analyzed: boolean;
    speed: number;
    mutability: number;
    harvest: number;
    // Needed for coercion to State. Doesn't seem to affect type hints
    [key: string]: State;
}

export type OptionalSeed = Seed | "none";

export interface Machine extends VueFeature {
    id: string;
    name: string;
    enabled: ProcessedComputable<boolean>;
    numInputs: number;
    baseDuration: number;
    isRunning: (inputs: OptionalSeed[], machineIndex: number) => boolean;
    onActivate: (inputs: OptionalSeed[], machineIndex: number) => void;
    outputDisplay: (inputs: OptionalSeed[], machineIndex: number) => CoercableComponent;
    inputs: Ref<OptionalSeed[][]>;
    timers: Ref<number[]>;
    collapsed: Ref<boolean>;
    duration: (inputs: OptionalSeed[]) => number;
    setInput: (machineIndex: number, index: number) => void;
    machines: GenericRepeatable;
    setPoweredUpMachine: (index: number) => void;
}

export interface Plant extends VueFeature {
    name: string;
    symbol: string;
    color: string;
    effectDescription: string;
    amount: Ref<DecimalSource>;
    consumedAmount: Ref<DecimalSource>;
    consumedTimeRemaining: Ref<number>;
    multiplier: Ref<DecimalSource>;
    discovered: Ref<boolean>;
    modifier: Modifier;
    consume: VoidFunction;
    seed: VueFeature;
}

const id = "breeding";
const layer = createLayer(id, function (this: BaseLayer) {
    const name = "Breeding Plants";
    const color = "#51D126";

    const mutations = createResource<DecimalSource>(0, "mutagens");
    const seeds = persistent<Seed[]>([
        { type: "moly", analyzed: false, speed: 1, mutability: 1, harvest: 1 }
    ]);
    const selectedSeed = persistent<OptionalSeed>("none");
    const recycling = persistent<OptionalSeed>("none");
    const poweredUpMachine = persistent<{ type: MachineTypes | "none"; index: number }>({
        type: "none",
        index: -1
    });
    const plantsCollapsed = persistent<boolean>(false);
    const seedsCollapsed = persistent<boolean>(false);

    const job = createJob(name, () => ({
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "75%",
            y: "60%"
        },
        symbol: "emoji_nature",
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: mutations,
        layerID: id,
        modifierInfo: jsx(() => renderJSX(generalTab)),
        visibility: study.milestones.jobMilestone.earned,
        showNotif: () =>
            Object.values(machines).some(
                machine =>
                    unref(machine.machines.canClick) ||
                    (seeds.value.length !== 0 &&
                        machine.inputs.value.some(
                            inputs =>
                                machine.numInputs !==
                                inputs.filter(seed => seed !== null && seed !== "none").length
                        ))
            )
    }));

    const breedingAnalyzingMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 2)),
        display: {
            requirement: `Achieve ${job.name} Level 2`,
            effectDisplay: "Unlock breeding and analyzing machines"
        }
    }));
    const powerupMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 4)),
        display: {
            requirement: `Achieve ${job.name} Level 4`,
            effectDisplay: "Unlock powering up machines"
        },
        visibility: breedingAnalyzingMilestone.earned
    }));
    const bonusGeneratorMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 5)),
        display: {
            requirement: `Achieve ${job.name} Level 5`,
            effectDisplay: 'Unlock bonus generator in "Harnessing Power" job'
        },
        visibility: powerupMilestone.earned
    }));
    const recyclingMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 6)),
        display: {
            requirement: `Achieve ${job.name} Level 6`,
            effectDisplay: "Unlock recycling machine"
        },
        visibility: bonusGeneratorMilestone.earned
    }));
    const mutatingMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 8)),
        display: {
            requirement: `Achieve ${job.name} Level 8`,
            effectDisplay: "Unlock mutating machine"
        },
        visibility: recyclingMilestone.earned
    }));
    const jobMilestone = createAchievement(() => ({
        requirements: createBooleanRequirement(() => Decimal.gte(job.rawLevel.value, 10)),
        display: {
            requirement: `Achieve ${job.name} Level 10`,
            effectDisplay: 'Unlock 1/2 of "Performing Rituals" Job'
        },
        visibility: mutatingMilestone.earned,
        onComplete() {
            if (generators.milestones.jobMilestone.earned.value) {
                addLayer(rituals, player);
            }
        }
    })) as GenericAchievement;
    const milestones = {
        breedingAnalyzingMilestone,
        powerupMilestone,
        bonusGeneratorMilestone,
        recyclingMilestone,
        mutatingMilestone,
        jobMilestone
    };
    const orderedMilestones = [
        jobMilestone,
        mutatingMilestone,
        recyclingMilestone,
        bonusGeneratorMilestone,
        powerupMilestone,
        breedingAnalyzingMilestone
    ];
    const collapseMilestones = persistent<boolean>(true);
    const lockedMilestones = computed(() =>
        orderedMilestones.filter(m => m.earned.value === false)
    );
    const { firstFeature, collapsedContent, hasCollapsedContent } = getFirstFeature(
        orderedMilestones,
        m => m.earned.value
    );

    function createPlant(
        optionsFunc: () => {
            name: string;
            symbol: string;
            color: string;
            effectDescription: string;
        }
    ): Plant {
        const amount = persistent<DecimalSource>(0);
        const consumedAmount = persistent<DecimalSource>(0);
        const consumedTimeRemaining = persistent<number>(0);
        const discovered = persistent<boolean>(false);

        return createLazyProxy(() => {
            const plant = optionsFunc();

            const multiplier = computed(() => Decimal.add(consumedAmount.value, 1).log10().add(1));

            return {
                ...plant,
                amount,
                consumedAmount,
                consumedTimeRemaining,
                discovered,
                multiplier,
                modifier: createMultiplicativeModifier(() => ({
                    multiplier,
                    description: `${plant.name} consumption`,
                    enabled: () => consumedTimeRemaining.value > 0
                })),
                consume: function () {
                    consumedAmount.value = amount.value;
                    consumedTimeRemaining.value = Decimal.pow(amount.value, 2)
                        .add(1)
                        .log2()
                        .toNumber();
                    amount.value = 0;
                    discovered.value = true;
                },
                seed: {
                    [Component]: coerceComponent(
                        `🌱<sub><span class="material-icons" style="color: ${plant.color}">${plant.symbol}</span></sub>`
                    ),
                    [GatherProps]: () => ({})
                },
                [Component]: Plant,
                [GatherProps]: function (this: Plant) {
                    const {
                        name,
                        symbol,
                        color,
                        effectDescription,
                        amount,
                        consumedTimeRemaining,
                        multiplier,
                        consume
                    } = this;
                    return {
                        name,
                        symbol,
                        color,
                        effectDescription,
                        amount,
                        consumedTimeRemaining,
                        multiplier,
                        consume
                    };
                }
            };
        });
    }

    const plants = {
        moly: createPlant(() => ({
            name: "Tempus Largitatis",
            symbol: flowers.job.symbol,
            color: flowers.job.color,
            effectDescription: "Moly gain"
        })),
        earthEssence: createPlant(() => ({
            name: "Terra Lupulus",
            symbol: distill.elements.earth.symbol,
            color: distill.elements.earth.color,
            effectDescription: "Earth essence gain"
        })),
        waterEssence: createPlant(() => ({
            name: "Aqua Lupulus",
            symbol: distill.elements.water.symbol,
            color: distill.elements.water.color,
            effectDescription: "Water essence gain"
        })),
        airEssence: createPlant(() => ({
            name: "Aer Lupulus",
            symbol: distill.elements.air.symbol,
            color: distill.elements.air.color,
            effectDescription: "Air essence gain"
        })),
        fireEssence: createPlant(() => ({
            name: "Ignis Lupulus",
            symbol: distill.elements.fire.symbol,
            color: distill.elements.fire.color,
            effectDescription: "Fire essence gain"
        })),
        properties: createPlant(() => ({
            name: "Discipulo Scriptor",
            symbol: study.job.symbol,
            color: study.job.color,
            effectDescription: "Properties gain"
        })),
        potentia: createPlant(() => ({
            name: "Glarea Fovea",
            symbol: experiments.job.symbol,
            color: experiments.job.color,
            effectDescription: "Potentia gain"
        })),
        energeia: createPlant(() => ({
            name: "Vis Salutarias",
            symbol: generators.job.symbol,
            color: generators.job.color,
            effectDescription: "Energeia gain"
        }))
    };

    function createMachine(
        name: string,
        priceRatio: DecimalSource,
        optionsFunc: () => {
            id: MachineTypes;
            enabled: Computable<boolean>;
            numInputs: number;
            baseDuration: number;
            durationModifier: Modifier;
            isRunning: (inputs: OptionalSeed[], machineIndex: number) => boolean;
            onActivate: (inputs: OptionalSeed[], machineIndex: number) => void;
            outputDisplay: (inputs: OptionalSeed[], machineIndex: number) => CoercableComponent;
        }
    ): Machine {
        const inputs = persistent<OptionalSeed[][]>([]);
        const timers = persistent<number[]>([]);
        const collapsed = persistent<boolean>(false);

        const machines = createRepeatable(() => ({
            initialValue: 1,
            visibility: generators.milestones.machinesMilestone.earned,
            requirements: createCostRequirement(() => ({
                cost: Formula.variable(machines.amount).pow_base(priceRatio),
                resource: generators.energeia
            })),
            display: {
                description: `Additional ${name.slice(0, -1)}`,
                showAmount: false
            },
            style: {
                width: "600px",
                minHeight: "unset"
            }
        })) as GenericRepeatable;

        return createLazyProxy(() => {
            const machine = optionsFunc();

            const enabled = convertComputable(machine.enabled);

            watch(machines.amount, numMachines => {
                while (Decimal.lt(inputs.value.length, numMachines)) {
                    inputs.value.push([]);
                }
                while (Decimal.lt(timers.value.length, numMachines)) {
                    timers.value.push(0);
                }
            });

            return {
                ...machine,
                name,
                priceRatio,
                enabled,
                inputs,
                timers,
                collapsed,
                machines,
                setInput: function (machineIndex: number, index: number) {
                    const prevValue = inputs.value[machineIndex]?.[index] ?? "none";
                    if (prevValue !== "none") {
                        seeds.value.push(prevValue);
                    }
                    const machineInputs = inputs.value[machineIndex] ?? [];
                    machineInputs[index] = selectedSeed.value;
                    inputs.value[machineIndex] = machineInputs;
                    seeds.value = seeds.value.filter(seed => seed !== selectedSeed.value);
                    selectedSeed.value = "none";
                },
                duration: function (inputs) {
                    const actualInputs = inputs.filter(input => input !== "none") as Seed[];
                    if (actualInputs.length === 0) {
                        return Infinity;
                    }
                    const averageInputSpeed =
                        actualInputs.map(input => input.speed).reduce((a, b) => a + b) /
                        actualInputs.length;
                    const duration = Decimal.times(
                        machine.baseDuration,
                        Decimal.pow(0.99, Decimal.sqrt(averageInputSpeed))
                    );
                    return new Decimal(machine.durationModifier.apply(duration)).toNumber();
                },
                setPoweredUpMachine(index) {
                    setPoweredUpMachine(machine.id, index);
                },
                [Component]: MachineType as GenericComponent,
                [GatherProps]: function (this: Machine) {
                    const {
                        id,
                        name,
                        enabled,
                        numInputs,
                        inputs,
                        timers,
                        collapsed,
                        machines,
                        duration,
                        outputDisplay,
                        setInput,
                        setPoweredUpMachine
                    } = this;
                    return {
                        id,
                        name,
                        enabled,
                        numInputs,
                        inputs,
                        timers,
                        collapsed,
                        machines,
                        poweredUpMachine,
                        canPowerUp: powerupMilestone.earned,
                        duration,
                        outputDisplay,
                        setInput,
                        setPoweredUpMachine
                    };
                }
            };
        });
    }

    const growMachines = createMachine("Growing Machines", 50, () => ({
        id: "growMachines",
        enabled: true,
        numInputs: 1,
        baseDuration: 100,
        durationModifier: createSequentialModifier(() => []),
        isRunning: inputs => Object.keys(inputs).length === 1 && inputs[0] !== "none",
        onActivate: inputs => {
            if (Object.keys(inputs).length === 0 || inputs[0] === "none") {
                return;
            }
            plants[inputs[0].type].amount.value = Decimal.add(
                plants[inputs[0].type].amount.value,
                inputs[0].harvest
            );
            const amountToGain = inputs[0].mutability;
            mutations.value = Decimal.add(mutations.value, amountToGain);
            job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(amountToGain));
        },
        outputDisplay: inputs =>
            jsx(() => {
                if (Object.keys(inputs).length === 0 || inputs[0] === "none") {
                    return (
                        <div>
                            <div style="font-size: xx-large">?</div>
                            <div>+1 mutations</div>
                        </div>
                    );
                } else {
                    return (
                        <div>
                            <div
                                style={{
                                    fontSize: "xx-large",
                                    color: plants[inputs[0].type].color
                                }}
                            >
                                {formatWhole(plants[inputs[0].type].amount.value)}{" "}
                                {plants[inputs[0].type].symbol}
                            </div>
                            <div>+ mutations</div>
                        </div>
                    );
                }
            })
    }));

    // God these names are disgusting
    const breedingOutputs = persistent<OptionalSeed[]>([]);
    function getBreedingCost(inputSeed: Seed) {
        const cost = Decimal.times(inputSeed.speed, inputSeed.harvest)
            .pow(2)
            .div(inputSeed.mutability)
            .ceil();
        // modifiers and type checks go here
        return cost;
    }
    function mutateStat(currentValue: number, mutability: number) {
        // modifiers to bias stats up go here
        return Decimal.max(
            1,
            Decimal.add(
                currentValue,
                Decimal.sqrt(mutability)
                    .times(Math.random() - 0.4)
                    .ceil()
            )
        ).toNumber();
    }
    const breedingMachines = createMachine("Breeding Machines", 80, () => ({
        id: "breedingMachines",
        enabled: breedingAnalyzingMilestone.earned,
        numInputs: 1,
        baseDuration: 600,
        durationModifier: createSequentialModifier(() => []),
        isRunning: (inputs, machineIndex) =>
            (breedingOutputs.value[machineIndex] ?? "none") === "none" &&
            Object.keys(inputs).length === 1 &&
            inputs[0] !== "none" &&
            Decimal.gte(mutations.value, getBreedingCost(inputs[0])),
        onActivate: (inputs, machineIndex) => {
            if (
                Object.keys(inputs).length !== 1 ||
                inputs[0] === "none" ||
                (breedingOutputs.value[machineIndex] != null &&
                    breedingOutputs.value[machineIndex] !== "none")
            ) {
                return;
            }
            mutations.value = Decimal.sub(mutations.value, getBreedingCost(inputs[0]));

            let { speed, harvest, mutability } = inputs[0];
            let type = inputs[0].type;
            if (
                Decimal.sub(
                    1,
                    Decimal.add(mutability, 1).log(1e6).pow(1.3).add(1).recip()
                ).toNumber() > Math.random()
            ) {
                type = Object.keys(plants)[
                    Math.floor(Math.random() * Object.keys(plants).length)
                ] as SeedTypes;
                speed = Math.sqrt(speed);
                harvest = Math.sqrt(harvest);
                mutability = Math.sqrt(mutability);
            }
            speed = mutateStat(speed, mutability);
            harvest = mutateStat(harvest, mutability);
            mutability = mutateStat(mutability, mutability);
            breedingOutputs.value[machineIndex] = {
                type,
                speed,
                harvest,
                mutability,
                analyzed: false
            };
        },
        outputDisplay: (inputs, index) =>
            jsx(() => (
                <div>
                    <SeedSlot
                        seed={breedingOutputs.value[index] ?? "none"}
                        onClick={currentSeed => {
                            const output = breedingOutputs.value[index];
                            if (currentSeed !== "none" && output != null && output !== "none") {
                                seeds.value.push(output);
                                breedingOutputs.value[index] = "none";
                            }
                        }}
                    />
                    {breedingMachines.isRunning(inputs, index) ? (
                        <div>
                            -{formatWhole(getBreedingCost(inputs[0] as Seed))}{" "}
                            {mutations.displayName}
                        </div>
                    ) : null}
                </div>
            ))
    }));

    const analyzingOutputs = persistent<OptionalSeed[]>([]);
    function getAnalyzingCost(inputSeed: Seed) {
        const cost = Decimal.times(inputSeed.speed, inputSeed.harvest)
            .times(inputSeed.mutability)
            .ceil();
        // modifiers and type checks go here
        return cost;
    }
    const analyzingMachines = createMachine("Analyzing Machines", 100, () => ({
        id: "analyzingMachines",
        enabled: breedingAnalyzingMilestone.earned,
        numInputs: 1,
        baseDuration: 1200,
        durationModifier: createSequentialModifier(() => []),
        isRunning: (inputs, machineIndex) =>
            (analyzingOutputs.value[machineIndex] ?? "none") === "none" &&
            Object.keys(inputs).length === 1 &&
            inputs[0] !== "none" &&
            inputs[0].analyzed === false &&
            Decimal.gte(flowers.flowers.value, getAnalyzingCost(inputs[0])),
        onActivate: (inputs, machineIndex) => {
            if (
                Object.keys(inputs).length !== 1 ||
                inputs[0] === "none" ||
                inputs[0].analyzed ||
                (analyzingOutputs.value[machineIndex] != null &&
                    analyzingOutputs.value[machineIndex] !== "none")
            ) {
                return;
            }
            flowers.flowers.value = Decimal.sub(flowers.flowers.value, getAnalyzingCost(inputs[0]));

            analyzingOutputs.value[machineIndex] = {
                ...inputs[0],
                analyzed: true
            };
            analyzingMachines.inputs.value[machineIndex] = [];
        },
        outputDisplay: (inputs, index) =>
            jsx(() => (
                <div>
                    <SeedSlot
                        seed={analyzingOutputs.value[index] ?? "none"}
                        onClick={currentSeed => {
                            const output = analyzingOutputs.value[index];
                            if (currentSeed !== "none" && output != null && output !== "none") {
                                seeds.value.push(output);
                                analyzingOutputs.value[index] = "none";
                            }
                        }}
                    />
                    {analyzingMachines.isRunning(inputs, index) ? (
                        <div>
                            -{formatWhole(getAnalyzingCost(inputs[0] as Seed))}{" "}
                            {flowers.flowers.displayName}
                        </div>
                    ) : null}
                </div>
            ))
    }));

    function getRecycledAmount(inputSeed: Seed) {
        const amount = Decimal.times(inputSeed.speed, inputSeed.harvest)
            .times(inputSeed.mutability)
            .ceil();
        // modifiers and type checks go here
        return amount;
    }
    const recyclingMachines = createMachine("Recycling Machines", 90, () => ({
        id: "recyclingMachines",
        enabled: recyclingMilestone.earned,
        numInputs: 1,
        baseDuration: 900,
        durationModifier: createSequentialModifier(() => []),
        isRunning: inputs => Object.keys(inputs).length === 1 && inputs[0] !== "none",
        onActivate: (inputs, machineIndex) => {
            if (Object.keys(inputs).length !== 1 || inputs[0] === "none") {
                return;
            }
            const amountToGain = getRecycledAmount(inputs[0]);
            mutations.value = Decimal.add(mutations.value, amountToGain);
            job.xp.value = Decimal.add(job.xp.value, jobXpGain.apply(amountToGain.times(10)));
            recyclingMachines.inputs.value[machineIndex] = [];
        },
        outputDisplay: (inputs, index) =>
            jsx(() => (
                <div>
                    {recyclingMachines.isRunning(inputs, index) && (inputs[0] as Seed).analyzed ? (
                        <div>
                            +{formatWhole(getRecycledAmount(inputs[0] as Seed))}{" "}
                            {mutations.displayName}
                            <br />
                            x10 exp gained
                        </div>
                    ) : (
                        <div>
                            + mutations
                            <br />
                            x10 exp gained
                        </div>
                    )}
                </div>
            ))
    }));

    // God these names are disgusting
    const mutatingOutputs = persistent<OptionalSeed[]>([]);
    function getMutateCost(inputSeed: Seed) {
        const cost = Decimal.times(inputSeed.mutability, 2).pow(2).ceil();
        // modifiers and type checks go here
        return cost;
    }
    const mutatingMachines = createMachine("Mutating Machines", 150, () => ({
        id: "mutatingMachines",
        enabled: mutatingMilestone.earned,
        numInputs: 1,
        baseDuration: 1800,
        durationModifier: createSequentialModifier(() => []),
        isRunning: (inputs, machineIndex) =>
            (mutatingOutputs.value[machineIndex] ?? "none") === "none" &&
            Object.keys(inputs).length === 1 &&
            inputs[0] !== "none" &&
            Decimal.gte(mutations.value, getMutateCost(inputs[0])),
        onActivate: (inputs, machineIndex) => {
            if (
                Object.keys(inputs).length !== 1 ||
                inputs[0] === "none" ||
                (mutatingOutputs.value[machineIndex] != null &&
                    mutatingOutputs.value[machineIndex] !== "none")
            ) {
                return;
            }
            mutations.value = Decimal.sub(mutations.value, getMutateCost(inputs[0]));
            mutatingOutputs.value[machineIndex] = {
                ...inputs[0],
                mutability: inputs[0].mutability * 2
            };
            mutatingMachines.inputs.value[machineIndex] = [];
        },
        outputDisplay: (inputs, index) =>
            jsx(() => (
                <div>
                    <SeedSlot
                        seed={mutatingOutputs.value[index] ?? "none"}
                        onClick={currentSeed => {
                            const output = mutatingOutputs.value[index];
                            if (currentSeed !== "none" && output != null && output !== "none") {
                                seeds.value.push(output);
                                mutatingOutputs.value[index] = "none";
                            }
                        }}
                    />
                    {mutatingMachines.isRunning(inputs, index) ? (
                        <div>
                            -{formatWhole(getMutateCost(inputs[0] as Seed))} {mutations.displayName}
                        </div>
                    ) : null}
                </div>
            ))
    }));

    const machines: Record<MachineTypes, Machine> = {
        growMachines,
        breedingMachines,
        analyzingMachines,
        recyclingMachines,
        mutatingMachines
    };

    function setPoweredUpMachine(type: keyof typeof machines, index: number) {
        poweredUpMachine.value = { type, index };
    }

    const jobLevelEffect: ComputedRef<DecimalSource> = computed(() =>
        Decimal.pow(1.1, job.level.value)
    );

    const discoveredFlowers = computed(
        () => Object.values(plants).filter(plant => plant.discovered.value).length
    );

    const timePassing = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: experiments.appliedTimeEffect,
            description: "Applied time",
            enabled: () =>
                experiments.job.active.value &&
                experiments.milestones.appliedTimeMilestone.earned.value &&
                experiments.selectedJob.value === id
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(1.1, discoveredFlowers.value),
            description: `Unique plants eaten (x1.1 each)`
        })),
        createMultiplicativeModifier(() => ({
            multiplier: jobLevelEffect,
            description: `${job.name} level (x1.1 each)`
        })),
        generators.batteries.breeding.timePassing.modifier
    ]) as WithRequired<Modifier, "invert" | "enabled" | "description">;
    const computedTimePassing = computed(() => new Decimal(timePassing.apply(1)).toNumber());

    const jobXpGain = createSequentialModifier(() => [
        generators.batteries.breeding.xpGain.modifier,
        createMultiplicativeModifier(() => ({
            multiplier: jobLevelEffect,
            description: `${job.name} level (x1.1 each)`
        }))
    ]);

    const modifiers = {
        timePassing,
        jobXpGain
    };

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Time Passing",
            modifier: timePassing,
            base: 1
        },
        {
            title: `${job.name} EXP Gain`,
            modifier: jobXpGain,
            base: 1
        }
    ]);
    const modifierTabs = createTabFamily(
        {
            general: () => ({
                display: "General",
                glowColor(): string {
                    return modifierTabs.activeTab.value === this.tab ? color : "";
                },
                tab: generalTab,
                generalTabCollapsed
            })
        },
        () => ({
            style: `--layer-color: ${color}`
        })
    );

    this.on("preUpdate", diff => {
        if (job.timeLoopActive.value === false && player.tabs[1] !== id) return;

        diff = Decimal.times(diff, computedTimePassing.value).toNumber();

        Object.values(machines).forEach(machine => {
            const timers = machine.timers.value;
            for (let i = 0; Decimal.lt(i, machine.machines.amount.value); i++) {
                const input = machine.inputs.value[i] ?? [];
                if (machine.isRunning(input, i)) {
                    timers[i] +=
                        poweredUpMachine.value.type === machine.id &&
                        poweredUpMachine.value.index === i
                            ? diff * 2
                            : diff;
                    if (Decimal.gte(timers[i], machine.duration(input))) {
                        machine.onActivate(machine.inputs.value[i], i);
                        timers[i] = 0;
                    }
                } else {
                    timers[i] = 0;
                }
            }
            machine.timers.value = timers;
        });
    });

    globalBus.on("update", (diff, trueDiff) => {
        if (job.timeLoopActive.value === false && player.tabs[1] !== id) return;

        Object.values(plants).forEach(plant => {
            if (plant.consumedTimeRemaining.value !== 0) {
                plant.consumedTimeRemaining.value = Math.max(
                    0,
                    plant.consumedTimeRemaining.value - trueDiff
                );
            }
        });
    });

    return {
        name,
        color,
        minWidth: 670,
        job,
        modifiers,
        milestones,
        collapseMilestones,
        modifierTabs,
        machines,
        seeds,
        selectedSeed,
        recycling,
        plants,
        breedingOutputs,
        analyzingOutputs,
        mutatingOutputs,
        poweredUpMachine,
        plantsCollapsed,
        seedsCollapsed,
        display: jsx(() => {
            const milestonesToDisplay = [...lockedMilestones.value];
            if (firstFeature.value) {
                milestonesToDisplay.push(firstFeature.value);
            }
            const plantsToDisplay = Object.keys(plants).filter(
                p =>
                    plants[p as SeedTypes].discovered.value ||
                    Decimal.gt(plants[p as SeedTypes].amount.value, 0)
            ) as SeedTypes[];
            return (
                <>
                    <MainDisplay resource={mutations} color={color} />
                    {renderColJSX(
                        ...milestonesToDisplay,
                        jsx(() => (
                            <Collapsible
                                collapsed={collapseMilestones}
                                content={collapsedContent}
                                display={
                                    collapseMilestones.value
                                        ? "Show other completed milestones"
                                        : "Hide other completed milestones"
                                }
                                v-show={unref(hasCollapsedContent)}
                            />
                        ))
                    )}
                    <Spacer />
                    {powerupMilestone.earned.value ? (
                        <>
                            <div>
                                Select a machine by clicking on its progress bar to make it work 2x
                                faster
                            </div>
                            <Spacer />
                        </>
                    ) : null}
                    {render(growMachines)}
                    {render(breedingMachines)}
                    {render(analyzingMachines)}
                    {render(recyclingMachines)}
                    {render(mutatingMachines)}
                    {plantsToDisplay.length > 0 ? (
                        <>
                            <Spacer />
                            <h2
                                class={{
                                    "breeding-collapsible": true,
                                    collapsed: plantsCollapsed.value
                                }}
                                onClick={() => (plantsCollapsed.value = !plantsCollapsed.value)}
                            >
                                <span class="toggle">▼</span>Plants
                            </h2>
                            {plantsCollapsed.value
                                ? null
                                : renderCol(...plantsToDisplay.map(plant => plants[plant]))}
                        </>
                    ) : null}
                    <Spacer />
                    <h2
                        class={{ "breeding-collapsible": true, collapsed: seedsCollapsed.value }}
                        onClick={() => (seedsCollapsed.value = !seedsCollapsed.value)}
                    >
                        <span class="toggle">▼</span>Seeds
                    </h2>
                    {seedsCollapsed.value ? null : (
                        <div style="width: 600px">
                            {seeds.value.map(seed => (
                                <SeedSlot
                                    seed={seed}
                                    selected={selectedSeed.value === seed}
                                    onClick={() => {
                                        selectedSeed.value =
                                            selectedSeed.value === seed ? "none" : seed;
                                    }}
                                />
                            ))}
                            <hr />
                            <div style="display: flex; align-items: center; text-align: left">
                                <SeedSlot
                                    seed={recycling.value}
                                    onClick={() => {
                                        if (selectedSeed.value === "none") {
                                            if (recycling.value !== "none") {
                                                seeds.value.push(recycling.value);
                                                recycling.value = "none";
                                            }
                                        } else {
                                            recycling.value = selectedSeed.value;
                                            seeds.value = seeds.value.filter(
                                                seed => seed !== selectedSeed.value
                                            );
                                            selectedSeed.value = "none";
                                        }
                                    }}
                                >
                                    {recycling.value === "none" ? (
                                        <div
                                            class="material-icons"
                                            style="font-size: xxx-large; color: var(--outline); position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);z-index: -1;"
                                        >
                                            delete
                                        </div>
                                    ) : null}
                                </SeedSlot>
                                <span style="margin-left: 10px">
                                    Click here to trash your selected seed, or restore your most
                                    recently trashed seed.
                                </span>
                            </div>
                        </div>
                    )}
                </>
            );
        })
    };
});

export default layer;
