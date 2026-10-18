// Reads STEP, IGES and BREP with OpenCascade (occt-import-js, WebAssembly) off the main thread,
// and sends back triangle meshes as transferable typed arrays.
const OCCT = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/";
importScripts(OCCT + "occt-import-js.js");
const ready = occtimportjs({locateFile: f => OCCT + f});
const PARAMS = {linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.001, angularDeflection: 0.5};

onmessage = async e => {
  const {id, kind, buffer} = e.data;
  try {
    const occt = await ready;
    const content = new Uint8Array(buffer);
    const r = kind === "step" ? occt.ReadStepFile(content, PARAMS) : kind === "iges" ? occt.ReadIgesFile(content, PARAMS) : occt.ReadBrepFile(content, PARAMS);
    if (!r || !r.success) { postMessage({id, ok: false, error: "OpenCascade could not read this file. Is it a valid " + kind.toUpperCase() + " file?"}); return; }
    const transfer = [];
    const meshes = r.meshes.map(m => {
      const position = new Float32Array(m.attributes.position.array);
      const normal = m.attributes.normal ? new Float32Array(m.attributes.normal.array) : null;
      const index = new Uint32Array(m.index.array);
      transfer.push(position.buffer, index.buffer);
      if (normal) transfer.push(normal.buffer);
      return {name: m.name, color: m.color || null, position, normal, index, faces: (m.brep_faces || []).map(f => ({first: f.first, last: f.last, color: f.color || null}))};
    });
    postMessage({id, ok: true, root: r.root, meshes}, transfer);
  } catch (err) {
    postMessage({id, ok: false, error: String(err && err.message || err)});
  }
};
