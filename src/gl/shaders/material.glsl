/*

Defines globals:
material
light_accumulator_*

*/


// MATERIALS
//
struct Material {
    #ifdef TANGRAM_MATERIAL_AMBIENT
        vec4 ambient;
    #endif

    #ifdef TANGRAM_MATERIAL_DIFFUSE
        vec4 diffuse;
    #endif
};

// Note: uniform is copied to a global instance to allow modification
uniform Material u_material;
Material material;

// Global light accumulators for each property
vec4 light_accumulator_ambient = vec4(vec3(0.0), 1.);
vec4 light_accumulator_diffuse = vec4(vec3(0.0), 1.);
