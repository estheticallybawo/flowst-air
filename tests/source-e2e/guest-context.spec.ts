import { expect,test } from '@playwright/test'
test('Standalone opens a private guest session without sign-in',async({page})=>{
 await page.goto('/airs/new')
 await expect(page).toHaveURL(/\/airs\/new$/)
 await expect(page.getByRole('region',{name:'Your learning context'})).toBeVisible()
 await page.getByLabel('Background',{exact:true}).fill('Early-career developer')
 await page.getByRole('button',{name:'Save context',exact:true}).click()
 await expect(page.getByText('Context saved. Misu will use this when preparing your next plan.')).toBeVisible()
 await page.getByLabel('Link or transcript',{exact:true}).check()
 await page.getByRole('button',{name:'Try video fixture'}).click()
 await page.getByRole('button',{name:'Create session plan',exact:true}).click()
 await expect(page.getByRole('region',{name:'Misu learning planner'})).toBeVisible({timeout:90000})
 await expect(page).toHaveURL(/\/airs\/[a-f0-9-]+$/)
})
