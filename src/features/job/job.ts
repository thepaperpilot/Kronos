import {
    Component,
    GatherProps,
    getUniqueID,
    Replace,
    setDefault,
    StyleValue,
    Visibility
} from "features/feature";
import JobComponent from "features/job/Job.vue";
import { createResource, Resource } from "features/resources/resource";
import { persistent, PersistentRef } from "game/persistence";
import Decimal, { DecimalSource } from "util/bignum";
import {
    Computable,
    GetComputableType,
    GetComputableTypeWithDefault,
    processComputable,
    ProcessedComputable
} from "util/computed";
import { createLazyProxy } from "util/proxies";
import { computed, Ref } from "vue";

export const JobType = Symbol("Job");
const levelSoftcapPower = 0.7643; // chosen so that e308 = level 100

declare module "@vue/runtime-dom" {
    interface CSSProperties {
        "--posx"?: string;
        "--posy"?: string;
        "--progress"?: string;
    }
}

export interface JobOptions {
    visibility?: Computable<Visibility>;
    classes?: Computable<Record<string, boolean>>;
    style?: Computable<StyleValue>;
    name: string;
    color: Computable<string>;
    image: Computable<string>;
    imageFocus: Computable<{ x: string; y: string }>;
    resource?: Resource;
    layerID: string;
}

export interface BaseJob {
    id: string;
    xp: Resource;
    rawLevel: Ref<DecimalSource>;
    level: Resource;
    levelProgress: Ref<number>;
    timeLoopActive: PersistentRef<boolean>;
    type: typeof JobType;
    [Component]: typeof JobComponent;
    [GatherProps]: () => Record<string, unknown>;
}

export type Job<T extends JobOptions> = Replace<
    T & BaseJob,
    {
        visibility: GetComputableTypeWithDefault<T["visibility"], Visibility.Visible>;
        classes: GetComputableType<T["classes"]>;
        style: GetComputableType<T["style"]>;
        color: GetComputableType<T["color"]>;
        image: GetComputableType<T["image"]>;
        imageFocus: GetComputableType<T["imageFocus"]>;
    }
>;

export type GenericJob = Replace<
    Job<JobOptions>,
    {
        visibility: ProcessedComputable<Visibility>;
    }
>;

export function createJob<T extends JobOptions>(optionsFunc: () => T & ThisType<Job<T>>): Job<T> {
    return createLazyProxy(() => {
        const job: T & Partial<BaseJob> = optionsFunc();
        job.id = getUniqueID("job-");
        job.type = JobType;
        job[Component] = JobComponent;

        job.xp = createResource<DecimalSource>(0, job.name + " XP");
        job.rawLevel = computed(() => {
            const genericJob = job as GenericJob;
            if (Decimal.eq(genericJob.xp.value, 0)) {
                return 1;
            }
            let baseLevel = Decimal.clampMin(genericJob.xp.value, 1).log10().add(1);
            if (baseLevel.gt(25)) {
                baseLevel = baseLevel.sub(25).pow(levelSoftcapPower).add(25);
            }
            return baseLevel.floor();
        });
        job.level = createResource<DecimalSource>(
            computed(() => (job as GenericJob).rawLevel.value),
            job.name + " Levels"
        );
        job.levelProgress = computed(() => {
            const genericJob = job as GenericJob;
            const level = genericJob.rawLevel.value;

            const prevRequirement = getXPRequirement(level);
            const nextRequirement = getXPRequirement(Decimal.add(level, 1));

            let progress;
            if (Decimal.lt(level, 25)) {
                // Linear
                progress = Decimal.sub(genericJob.xp.value, prevRequirement)
                    .div(Decimal.sub(nextRequirement, prevRequirement))
                    .toNumber();
            } else {
                // Logarithmic
                progress = Decimal.log10(genericJob.xp.value)
                    .sub(Decimal.log10(prevRequirement))
                    .div(Decimal.log10(nextRequirement).sub(Decimal.log10(prevRequirement)))
                    .toNumber();
            }
            return progress;
        });
        job.timeLoopActive = persistent<boolean>(false);

        processComputable(job as T, "visibility");
        setDefault(job, "visibility", Visibility.Visible);
        processComputable(job as T, "classes");
        processComputable(job as T, "style");
        processComputable(job as T, "color");
        processComputable(job as T, "image");
        processComputable(job as T, "imageFocus");

        job[GatherProps] = function (this: GenericJob) {
            const {
                id,
                xp,
                level,
                levelProgress,
                timeLoopActive,
                name,
                visibility,
                color,
                image,
                imageFocus,
                resource,
                layerID,
                classes,
                style
            } = this;
            return {
                id,
                xp,
                level,
                levelProgress,
                timeLoopActive,
                name,
                visibility,
                color,
                image,
                imageFocus,
                resource,
                layerID,
                classes,
                style
            };
        };

        return job as unknown as Job<T>;
    });
}

function getXPRequirement(level: DecimalSource): DecimalSource {
    if (Decimal.eq(level, 1)) {
        return 0;
    }
    if (Decimal.gt(level, 25)) {
        level = Decimal.sub(level, 25)
            .pow(1 / levelSoftcapPower)
            .add(25);
    }
    return Decimal.sub(level, 1).pow10();
}
