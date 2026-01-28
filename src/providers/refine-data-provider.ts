/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProvider } from "@refinedev/core";
import { supabase } from "@/integrations/supabase/client";

type SupabaseTable = 'menu_items' | 'menus' | 'menu_categories' | 'event_inquiries' | 'catering_orders' | 'customer_profiles' | 'packages' | 'email_templates';

const mapResource = (resource: string): SupabaseTable => {
  const mapping: Record<string, SupabaseTable> = {
    'menu_items': 'menu_items',
    'menus': 'menus',
    'menu_categories': 'menu_categories',
    'events': 'event_inquiries',
    'event_inquiries': 'event_inquiries',
    'orders': 'catering_orders',
    'catering_orders': 'catering_orders',
    'customers': 'customer_profiles',
    'customer_profiles': 'customer_profiles',
    'packages': 'packages',
    'email_templates': 'email_templates',
  };
  return mapping[resource] || resource as SupabaseTable;
};

type FilterOperator = 'eq' | 'ne' | 'lt' | 'gt' | 'lte' | 'gte' | 'contains' | 'containss' | 'in';

interface CrudFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

const applyFilter = (query: any, filter: CrudFilter): any => {
  const { field, operator, value } = filter;
  switch (operator) {
    case 'eq':
      return query.eq(field, value);
    case 'ne':
      return query.neq(field, value);
    case 'lt':
      return query.lt(field, value);
    case 'gt':
      return query.gt(field, value);
    case 'lte':
      return query.lte(field, value);
    case 'gte':
      return query.gte(field, value);
    case 'contains':
      return query.ilike(field, `%${value}%`);
    case 'containss':
      return query.like(field, `%${value}%`);
    case 'in':
      return query.in(field, value as string[]);
    default:
      return query;
  }
};

export const supabaseDataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters }) => {
    const tableName = mapResource(resource);
    
    let query = supabase.from(tableName).select('*', { count: 'exact' });
    
    // Apply filters
    if (filters) {
      for (const filter of filters) {
        if ('field' in filter && 'value' in filter) {
          query = applyFilter(query, filter as CrudFilter);
        }
      }
    }
    
    // Apply sorting
    if (sorters && sorters.length > 0) {
      for (const sorter of sorters) {
        query = query.order(sorter.field, { ascending: sorter.order === 'asc' });
      }
    } else {
      query = query.order('created_at', { ascending: false });
    }
    
    // Apply pagination
    if (pagination) {
      const current = (pagination as Record<string, number>).current ?? 1;
      const pageSize = (pagination as Record<string, number>).pageSize ?? 10;
      const start = (current - 1) * pageSize;
      query = query.range(start, start + pageSize - 1);
    }
    
    const { data, count, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return {
      data: (data || []) as any[],
      total: count || 0,
    };
  },

  getOne: async ({ resource, id }) => {
    const tableName = mapResource(resource);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', String(id))
      .single();
    
    if (error) {
      throw error;
    }
    
    return {
      data: data as any,
    };
  },

  create: async ({ resource, variables }) => {
    const tableName = mapResource(resource);
    const client = supabase as any;
    
    const { data, error } = await client
      .from(tableName)
      .insert(variables)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return {
      data: data as any,
    };
  },

  update: async ({ resource, id, variables }) => {
    const tableName = mapResource(resource);
    const client = supabase as any;
    
    const { data, error } = await client
      .from(tableName)
      .update(variables)
      .eq('id', String(id))
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return {
      data: data as any,
    };
  },

  deleteOne: async ({ resource, id }) => {
    const tableName = mapResource(resource);
    
    const { data, error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', String(id))
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return {
      data: data as any,
    };
  },

  getMany: async ({ resource, ids }) => {
    const tableName = mapResource(resource);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .in('id', ids.map(String));
    
    if (error) {
      throw error;
    }
    
    return {
      data: (data || []) as any[],
    };
  },

  getApiUrl: () => {
    return import.meta.env.VITE_SUPABASE_URL || '';
  },
};
