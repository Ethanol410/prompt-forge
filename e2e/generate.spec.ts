import { test, expect } from '@playwright/test';

test.describe('PromptForge — flux web', () => {
  test('génère un prompt (fallback déterministe hors-ligne)', async ({ page }) => {
    await page.goto('/');

    // Provider local Ollama (pas de clé requise) : injoignable en test → fallback déterministe.
    await page.getByRole('combobox').nth(1).selectOption('ollama');
    await page.getByLabel('Décris ton besoin').fill('Un prompt de test e2e');
    await page.getByRole('button', { name: 'Générer ✶' }).click();

    // Une carte de version apparaît, avec le badge qualité.
    await expect(page.getByText('Prompt généré')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Qualité : \d+\/100/)).toBeVisible();

    // L'intention apparaît en bulle dans le fil (région role=log, correspondance exacte).
    await expect(
      page.getByRole('log').getByText('Un prompt de test e2e', { exact: true }),
    ).toBeVisible();
  });

  test('crée un template personnalisé et le sélectionne', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Nouveau template' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('nom du template').fill('Template e2e');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Le template custom apparaît, sélectionné, dans le sélecteur de catégorie.
    await expect(page.getByRole('option', { name: /Template e2e/ })).toHaveCount(1);
  });

  test('supprime une seule entrée d’historique', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox').nth(1).selectOption('ollama');
    await page.getByLabel('Décris ton besoin').fill('Entrée à supprimer');
    await page.getByRole('button', { name: 'Générer ✶' }).click();
    await expect(page.getByText('Prompt généré')).toBeVisible({ timeout: 20_000 });

    const item = page.getByRole('listitem').filter({ hasText: 'Entrée à supprimer' });
    await expect(item).toHaveCount(1);
    await item.getByRole('button', { name: 'supprimer cette entrée' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Entrée à supprimer' })).toHaveCount(0);
  });
});
