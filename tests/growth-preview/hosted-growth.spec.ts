import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Growth belongs to the production-built Airs app, with normal auth and navigation", async ({ page, request, isMobile }) => {
  const mutations: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.route("**/api/**", route => {
    const r=route.request(), pathname=new URL(r.url()).pathname;
    // Auth is real for this production-build check, using a fresh test-only signing key.
    if(pathname === "/api/auth/session") return route.continue();
    if(r.method() !== "GET") { mutations.push(pathname); return route.abort(); }
    if(pathname === "/api/air/access") return route.fulfill({json:{tier:"FREE_PILOT",allowedActions:{UPLOAD:true,PLAN:true,PRACTISE:true,SPEECH:true},limits:{uploadBytes:10000000,uploadPolicy:"OBJECTIVE_COMPLETION"},usage:{completionRequired:false},upgradeAvailable:false}});
    if(pathname === "/api/study/upload-eligibility") return route.fulfill({json:{canUpload:true,completionRequired:false}});
    if(pathname === "/api/study/conversations") return route.fulfill({json:[]});
    if(pathname === "/api/study/context") return route.fulfill({json:{context:{background:"",goals:"",audience:"",origin:"LEARNER_CONFIRMED",recordedAt:""},memory:null}});
    return route.fulfill({json:{}});
  });
  const response=await page.goto("/airs");
  expect(response?.status()).toBe(200);
  expect((await response!.allHeaders())["set-cookie"]).toContain("airs_guest=");
  await expect(page.locator('.growth-home[data-growth-ready="true"]')).toBeVisible();
  await expect(page.locator(".capability-card")).toHaveCount(7);
  await expect(page.locator(".growth-data-note")).toContainText("Example growth data");
  await expect(page.locator(".air-account")).toBeVisible();
  await expect(page.getByRole("link",{name:"Start a new session",exact:true})).toHaveAttribute("href","/airs/new");
  await expect(page.locator(".growth-example-tools")).not.toHaveAttribute("open");
  await expect(page.getByRole("button",{name:"Apply example session",exact:true})).toBeHidden();
  await page.getByText("Explore example progress",{exact:true}).click();
  await page.getByRole("button",{name:"Apply example session",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("72% → 84%");
  await page.getByRole("button",{name:"Back to growth",exact:true}).click();
  const nav=page.getByRole("navigation",{name:"Flowst Airs navigation"});
  for(const [name,route] of [["New session","new"],["Library","library"],["Settings","settings"]]) {
    await nav.getByRole("link",{name,exact:true}).click();
    await expect(page).toHaveURL(new RegExp("/airs/"+route+"$"));
    if(route === "new") await expect(page.getByLabel("Share context about yourself",{exact:true})).toBeVisible();
    if(route === "library") await expect(page.locator(".air-library")).toBeVisible();
    if(route === "settings") await expect(page.getByRole("heading",{name:"Settings",exact:true})).toBeVisible();
    if(route === "new") await page.goBack();
    else await nav.getByRole("link",{name:"Home",exact:true}).click();
    await expect(page.getByRole("button",{name:"Explore Clear Explanation",exact:true})).toContainText("84%");
  }
  // The normal API boundary, rather than a Growth blanket 503, handles auth and CSRF.
  const session=await request.get("/api/auth/session");
  expect(session.status()).toBe(200);
  expect(await session.json()).toMatchObject({authenticated:true});
  const csrf=await request.post("/api/auth/session",{headers:{origin:"https://outside.invalid"}});
  expect(csrf.status()).toBe(403);
  expect(await csrf.text()).not.toContain("GROWTH_SAMPLE_PREVIEW");
  expect((await page.context().cookies()).some(c=>c.name === "airs_guest")).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/integrated-growth-"+(isMobile?"mobile":"desktop")+".png",fullPage:true});
});
