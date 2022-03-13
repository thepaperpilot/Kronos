/**
 * @module
 * @hidden
 */
import { jsx } from "features/feature";
import { createJob } from "features/job/job";
import { createResource } from "features/resources/resource";
import { createLayer } from "game/layers";
import { DecimalSource } from "util/bignum";
import globalQuips from "../quips.json";
import alwaysQuips from "./quips.json";

const layer = createLayer(() => {
    const id = "flowers";
    const name = "Harvesting Flowers";
    const color = "#F1EBD9";

    const flowers = createResource<DecimalSource>(0, "flowers");

    const job = createJob(() => ({
        name,
        color,
        image: "https://dummyimage.com/512x288/000/fff.png",
        imageFocus: {
            x: "75%",
            y: "30%"
        },
        randomQuips() {
            return [...alwaysQuips, ...globalQuips];
        },
        resource: flowers,
        layerID: id
    }));

    return {
        id,
        name,
        color,
        flowers,
        job,
        display: jsx(() => <>Placeholder</>)
    };
});

export default layer;
