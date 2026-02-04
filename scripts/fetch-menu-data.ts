/**
 * SSG Menu Data Fetcher for events-storia.de
 * Fetches menu data from Supabase at build time for SSG
 * Run: npx tsx scripts/fetch-menu-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Required: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface MenuItem {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | null;
  price_display: string | null;
  image_url: string | null;
  serving_info: string | null;
  serving_info_en: string | null;
  min_order: string | null;
  min_order_en: string | null;
  sort_order: number;
  is_vegetarian: boolean;
  is_vegan: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  sort_order: number;
  items: MenuItem[];
}

interface CateringMenu {
  id: string;
  title: string | null;
  title_en: string | null;
  subtitle: string | null;
  subtitle_en: string | null;
  slug: string | null;
  is_published: boolean;
  additional_info: string | null;
  additional_info_en: string | null;
  created_at: string;
  updated_at: string;
  categories: MenuCategory[];
}

async function fetchMenuData(): Promise<void> {
  console.log('🍕 Fetching catering menu data from Supabase...');

  try {
    // Fetch all published catering menus
    const { data: menus, error: menusError } = await supabase
      .from('menus')
      .select('*')
      .eq('menu_type', 'catering')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (menusError) {
      throw new Error(`Failed to fetch menus: ${menusError.message}`);
    }

    if (!menus || menus.length === 0) {
      console.log('⚠️  No published catering menus found');
      writeEmptyData();
      return;
    }

    // Fetch categories and items for each menu
    const menusWithContent: CateringMenu[] = await Promise.all(
      menus.map(async (menu) => {
        const { data: categories, error: catError } = await supabase
          .from('menu_categories')
          .select('*')
          .eq('menu_id', menu.id)
          .order('sort_order', { ascending: true });

        if (catError) {
          console.warn(`⚠️  Error fetching categories for menu ${menu.slug}: ${catError.message}`);
          return { ...menu, categories: [] };
        }

        const categoriesWithItems: MenuCategory[] = await Promise.all(
          (categories || []).map(async (category) => {
            const { data: items, error: itemsError } = await supabase
              .from('menu_items')
              .select('*')
              .eq('category_id', category.id)
              .order('sort_order', { ascending: true });

            if (itemsError) {
              console.warn(`⚠️  Error fetching items for category ${category.name}: ${itemsError.message}`);
              return { ...category, items: [] };
            }

            return {
              ...category,
              items: items || [],
            };
          })
        );

        return {
          ...menu,
          categories: categoriesWithItems,
        };
      })
    );

    // Count total items
    const totalItems = menusWithContent.reduce(
      (acc, menu) =>
        acc +
        menu.categories.reduce((catAcc, cat) => catAcc + cat.items.length, 0),
      0
    );

    // Ensure output directory exists
    const outputDir = resolve(process.cwd(), 'src', 'data');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write menu data to JSON file
    const outputPath = resolve(outputDir, 'static-menus.json');
    writeFileSync(outputPath, JSON.stringify(menusWithContent, null, 2), 'utf-8');

    console.log(`✅ Menu data fetched successfully!`);
    console.log(`   - ${menusWithContent.length} menus`);
    console.log(`   - ${totalItems} total items`);
    console.log(`   - Output: ${outputPath}`);

  } catch (error) {
    console.error('❌ Failed to fetch menu data:', error);
    writeEmptyData();
  }
}

function writeEmptyData(): void {
  const outputDir = resolve(process.cwd(), 'src', 'data');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = resolve(outputDir, 'static-menus.json');
  writeFileSync(outputPath, '[]', 'utf-8');
  console.log(`📄 Empty menu data written to: ${outputPath}`);
}

// Execute
fetchMenuData();
