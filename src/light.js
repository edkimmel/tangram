import ShaderProgram from './gl/shader_program';
import GLSL from './gl/glsl';
import Geo from './geo';
import Vector from './vector';
import StyleParser from './styles/style_parser';

let fs = require('fs');

const shaderSrc_directionalLight = fs.readFileSync(__dirname + '/gl/shaders/directionalLight.glsl', 'utf8');

// Abstract light
export default class Light {

    constructor (view, config) {
        this.name = config.name;
        this.view = view;

        if (config.ambient == null || typeof config.ambient === 'number') {
            this.ambient = GLSL.expandVec3(config.ambient || 0);
        }
        else {
            this.ambient = StyleParser.parseColor(config.ambient).slice(0, 3);
        }

        if (config.diffuse == null || typeof config.diffuse === 'number') {
            this.diffuse = GLSL.expandVec3(config.diffuse != null ? config.diffuse : 1);
        }
        else {
            this.diffuse = StyleParser.parseColor(config.diffuse).slice(0, 3);
        }
    }

    // Create a light by type name, factory-style
    // 'config' must include 'name' and 'type', along with any other type-specific properties
    static create (view, config) {
        if (Light.types[config.type]) {
            return new Light.types[config.type](view, config);
        }
    }

    // Set light for a style: fragment lighting, vertex lighting, or none
    static setMode (mode, style) {
        if (mode === true) {
            mode = 'fragment';
        }
        mode = Light.enabled && ((mode != null) ? mode : 'fragment'); // default to fragment lighting
        style.defines['TANGRAM_LIGHTING_FRAGMENT'] = (mode === 'fragment');
        style.defines['TANGRAM_LIGHTING_VERTEX'] = (mode === 'vertex');
    }

    // Inject all provided light definitions, and calculate cumulative light function
    static inject (lights) {
        // Clear previous injections
        ShaderProgram.removeBlock(Light.block);

        // If lighting is globally disabled, nothing is injected (mostly for debugging or live editing)
        if (!Light.enabled) {
            return;
        }

        // Construct code to calculate each light instance
        let calculateLights = "";
        if (lights && Object.keys(lights).length > 0) {
            // Collect uniques types of lights
            let types = {};
            for (let light_name in lights) {
                types[lights[light_name].type] = true;
            }

            // Inject each type of light
            for (let type in types) {
                Light.types[type].inject();
            }

            // Inject per-instance blocks and construct the list of functions to calculate each light
            for (let light_name in lights) {
                // Define instance
                lights[light_name].inject();

                // Add the calculation function to the list
                calculateLights += `calculateLight(${light_name}, _eyeToPoint, _normal);\n`;
            }
        }

        // Glue together the final lighting function that sums all the lights
        let calculateFunction = `
            vec4 calculateLighting(in vec3 _eyeToPoint, in vec3 _normal, in vec4 _color) {

                // Un roll the loop of individual ligths to calculate
                ${calculateLights}

                //  Final light intensity calculation
                vec4 color = vec4(vec3(0.), _color.a); // start with vertex color alpha

                #ifdef TANGRAM_MATERIAL_AMBIENT
                    color.rgb += light_accumulator_ambient.rgb * _color.rgb * material.ambient.rgb;
                    color.a *= material.ambient.a;
                #else
                    #ifdef TANGRAM_MATERIAL_DIFFUSE
                        color.rgb += light_accumulator_ambient.rgb * _color.rgb * material.diffuse.rgb;
                    #endif
                #endif

                #ifdef TANGRAM_MATERIAL_DIFFUSE
                    color.rgb += light_accumulator_diffuse.rgb * _color.rgb * material.diffuse.rgb;
                    color.a *= material.diffuse.a;
                #endif

                // Clamp final color
                color = clamp(color, 0.0, 1.0);

                return color;
            }`;

        ShaderProgram.addBlock(Light.block, calculateFunction);
    }

    // Common instance definition
    inject () {
        let instance =  `
            uniform ${this.struct_name} u_${this.name};
            ${this.struct_name} ${this.name};
            `;
        let assign = `
            ${this.name} = u_${this.name};\n
        `;

        ShaderProgram.addBlock(Light.block, instance);
        ShaderProgram.addBlock('setup', assign);
    }

    // Update method called once per frame
    update () {
    }

    // Called once per frame per program (e.g. for main render pass, then for each additional
    // pass for feature selection, etc.)
    setupProgram (_program) {
        //  Three common light properties
        _program.uniform('3fv', `u_${this.name}.ambient`, this.ambient);
        _program.uniform('3fv', `u_${this.name}.diffuse`, this.diffuse);
    }

}

Light.types = {}; // references to subclasses by short name
Light.block = 'lighting'; // shader block name
Light.enabled = true; // lighting can be globally enabled/disabled

class DirectionalLight extends Light {

    constructor(view, config) {
        super(view, config);
        this.type = 'directional';
        this.struct_name = 'DirectionalLight';

        if (config.direction) {
            this._direction = config.direction;
        }
        else {
            // Default directional light maintains full intensity on ground, with basic extrusion shading
            let theta = 135; // angle of light in xy plane (rotated around z axis)
            let scale = Math.sin(Math.PI*60/180); // scaling factor to keep total directional intensity to 0.5
            this._direction = [
                Math.cos(Math.PI*theta/180) * scale,
                Math.sin(Math.PI*theta/180) * scale,
                -0.5
            ];

            if (config.ambient == null) {
                this.ambient = GLSL.expandVec3(0.5);
            }
        }
        this.direction = this._direction.map(parseFloat);
    }

    get direction () {
        return this._direction;
    }

    set direction (v) {
        this._direction = Vector.normalize(Vector.copy(v));
    }

    // Inject struct and calculate function
    static inject() {
        ShaderProgram.addBlock(Light.block, shaderSrc_directionalLight);
    }

    setupProgram (_program) {
        super.setupProgram(_program);
        _program.uniform('3fv', `u_${this.name}.direction`, this.direction);
    }

}
Light.types['directional'] = DirectionalLight;
