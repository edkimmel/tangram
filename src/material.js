import GLSL from './gl/glsl';
import StyleParser from './styles/style_parser';

let fs = require('fs');
const shaderSrc_material = fs.readFileSync(__dirname + '/gl/shaders/material.glsl', 'utf8');

const material_props = ['ambient', 'diffuse'];

export default class Material {
    constructor (config) {

        config = config || {};

        // These properties all have the same defaults, so they can be set in bulk
        material_props.forEach(prop => {
            const value = config[prop];
            if (value != null) {
                if (typeof value === 'number' || Array.isArray(value)) {
                    this[prop] = { amount: GLSL.expandVec4(value) };
                }
                else if (typeof value === 'string') {
                    this[prop] = { amount: StyleParser.parseColor(value) };
                }
                else {
                    this[prop] = value;
                }
            }
        });
    }

    // Determine if a material config block has sufficient properties to create a material
    static isValid (config) {
        if (config == null) {
            return false;
        }

        if (config.ambient == null &&
            config.diffuse == null) {
            return false;
        }

        return true;
    }

    inject (style) {
        // For each property, sets defines to configure texture mapping, with a pattern like:
        //   TANGRAM_MATERIAL_DIFFUSE, TANGRAM_MATERIAL_DIFFUSE_TEXTURE, TANGRAM_MATERIAL_DIFFUSE_TEXTURE_SPHEREMAP
        // Also sets flags to keep track of each unique mapping type being used, e.g.:
        //   TANGRAM_MATERIAL_TEXTURE_SPHEREMAP
        // Enables texture coordinates if needed and not already on
        material_props.forEach(prop => {
            let def = `TANGRAM_MATERIAL_${prop.toUpperCase()}`;
            let texdef = def + '_TEXTURE';
            style.defines[def] = (this[prop] != null);
        });

        style.replaceShaderBlock(Material.block, shaderSrc_material, 'Material');
        style.addShaderBlock('setup', '\nmaterial = u_material;\n', 'Material');
    }

    setupProgram (_program) {
        // For each property, sets uniforms in the pattern:
        // u_material.diffuse, u_material.diffuseScale u_material_diffuse_texture
        material_props.forEach(prop => {
            if (this[prop]) {
                _program.uniform('4fv', `u_material.${prop}`, this[prop].amount);
            }
        });
    }
}

Material.block = 'material';
