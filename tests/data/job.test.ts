import { createJob, GenericJob } from "features/job/job";
import Decimal from "util/bignum";
import { beforeEach, describe, expect, test } from "vitest";
import "../utils";

describe("Level Formula", () => {
    let job: GenericJob;
    beforeEach(() => {
        job = createJob("test", () => ({
            color: "red",
            image: "dummy",
            imageFocus: { x: "0", y: "0" },
            layerID: "dummy",
            symbol: "d"
        }));
    });

    test("Level = 10^n EXP up to 25", () => {
        test.each(new Array(24).fill(0).map((_, i) => i + 1))("%i:", level => {
            job.xp.value = Decimal.pow10(level - 1);
            expect(job.level.value).compare_tolerance(level);
        });
    });

    describe("5.5*10^n is 50% to next level up to 25", () => {
        test.each(new Array(24).fill(0).map((_, i) => i + 1))("%i:", level => {
            job.xp.value = Decimal.pow10(level - 1).times(5.5);
            expect(job.levelProgress.value).compare_tolerance(0.5);
        });
    });

    describe("Level softcap applies after 25", () => {
        describe.each([...new Array(10).fill(0).map((_, i) => i + 25), 100, 1e308])(
            "%i:",
            level => {
                test("XP required", () => expect(job.levelFormula.invert(level)).toMatchSnapshot());
                test("Calculates level correctly", () => {
                    const requiredXp = job.levelFormula.invert(level);
                    job.xp.value = requiredXp;
                    expect(job.level.value).compare_tolerance(level);
                    expect(job.levelProgress.value).compare_tolerance(0);
                });
                // Not sure how to implement this without just duplicating the code itself
                test.todo("Calculates 50% level progress correctly");
            }
        );
    });
});
