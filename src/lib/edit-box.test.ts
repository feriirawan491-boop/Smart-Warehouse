import { describe, expect, it } from "vitest";
import { sampleBoxes } from "./data";
import { updateBox } from "./edit-box";

describe("editing box details", () => {
  const original = sampleBoxes[0];
  it("allows the box's own identifiers and preserves other boxes", () => {
    const edited = {...original,name:"  BOX BARU  ",devices:original.devices.map((device,index)=>index===0?{...device,serial:"003246287562"}:device)};
    const result = updateBox(sampleBoxes, original, edited);
    expect(result[0].name).toBe("BOX BARU");
    expect(result[0].devices[0].serial).toBe("003246287562");
    expect(result.slice(1)).toEqual(sampleBoxes.slice(1));
    expect(updateBox(result,result[0],{...result[0],name:"Edit kedua"})[0].name).toBe("Edit kedua");
  });
  it("rejects another box's serial and a serial duplicated within the draft", () => {
    const devices = [{id:"1",mac:"",serial:sampleBoxes[1].devices[0].serial}];
    expect(()=>updateBox(sampleBoxes, original, {...original,devices})).toThrow("sudah terdaftar");
    const duplicate = {...devices[0],serial:"003246287562"};
    expect(()=>updateBox(sampleBoxes, original, {...original,devices:[duplicate,{...duplicate,id:"2"}]})).toThrow("baris 1, 2");
  });
  it("rejects duplicate box numbers and incomplete serials", () => {
    expect(()=>updateBox(sampleBoxes, original, {...original,number:sampleBoxes[1].number})).toThrow("sudah tercatat");
    expect(()=>updateBox(sampleBoxes, original, {...original,devices:[{id:"1",mac:"",serial:"123"}]})).toThrow("SN 12 digit");
    expect(()=>updateBox(sampleBoxes, original, {...original,devices:[]})).toThrow("minimal satu");
  });
  it("does not recreate a deleted box or overwrite a newer edit", () => {
    expect(()=>updateBox([], original, original)).toThrow("sudah dihapus");
    const changed = [{...original,name:"Changed elsewhere"},...sampleBoxes.slice(1)];
    expect(()=>updateBox(changed, original, original)).toThrow("tab lain");
  });
});
