import { expect, test } from "vitest";
import { applyGrowthSession, completeGrowthCycle, createGrowthPrototype, retryGrowthPreview } from "../shared/airGrowthPrototype";
import { growthBadgeStage, type GrowthSnapshot } from "../shared/airGrowth";
import { growthCapabilities } from "../shared/airGrowthCapabilities";

test("example assessment updates and cycle completion cannot credit the same evidence twice",()=>{
  const state=createGrowthPrototype();
  completeGrowthCycle(state); expect(state.completion).toBeNull();
  applyGrowthSession(state); applyGrowthSession(state);
  expect(state.dimensions.find(d=>d.dimensionId === "clear_explanation")?.progress).toBe(84);
  expect(state.dimensions.find(d=>d.dimensionId === "transfer")?.progress).toBe(30);
  const count=state.flowmarks.length;
  completeGrowthCycle(state); completeGrowthCycle(state); applyGrowthSession(state);
  const reasoning=state.dimensions.find(d=>d.dimensionId === "reasoning_aloud")!;
  expect(reasoning).toMatchObject({completedCycles:5,progress:0,evidence:[]});
  expect(state.flowmarks).toHaveLength(count+1);
  expect(state.completion).toMatchObject({completedCycle:5,progress:100});
  expect(growthBadgeStage(reasoning.completedCycles)).toBe(3);
  expect(reasoning.history.at(-1)?.flowmarkId).toBe(state.completion?.flowmarkId);
});
test("review recovery retains progress; a new learner starts with all seven capabilities",()=>{
  for(const scenario of ["pending","failed"] as const){
    const state=createGrowthPrototype(scenario), before=JSON.stringify(state.dimensions);
    applyGrowthSession(state); completeGrowthCycle(state); retryGrowthPreview(state);
    expect(state.reviewStatus).toBe("ready"); expect(JSON.stringify(state.dimensions)).toBe(before);
  }
  const fresh=createGrowthPrototype("new");
  expect(fresh.dimensions.map(d=>d.dimensionId)).toEqual(growthCapabilities.map(c=>c.id));
  expect(fresh.dimensions.every(d=>!d.progress && !d.completedCycles && !d.evidence.length)).toBe(true);
  expect(fresh.flowmarks).toEqual([]);
});
test("the product snapshot accepts assessed records without example walkthrough controls",()=>{
  const example=createGrowthPrototype();
  const snapshot:GrowthSnapshot={source:"assessed",reviewStatus:"ready",dimensions:example.dimensions,flowmarks:example.flowmarks.map(m=>({...m,source:"assessed"})),sessionChanges:[],completion:null};
  expect(snapshot.flowmarks.every(m=>m.source === "assessed")).toBe(true);
  expect(snapshot).not.toHaveProperty("scenario");
  expect(snapshot).not.toHaveProperty("sessionApplied");
});
