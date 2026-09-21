'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag, Search, Download, RefreshCw, ExternalLink,
  CheckCircle2, AlertCircle, Loader2, ArrowUpDown, Filter,
  Layers, MapPin, Tag, ArrowRight, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, Sparkles, Building2, Eye, FileSpreadsheet, FileText,
  ImageIcon, Maximize2, X
} from 'lucide-react';
import { api, ScrapeJob, ScrapedProduct, PaginatedProductsResponse } from '@/lib/api';

export default function ProductScraperPage() {
  const [url, setUrl] = useState('');
  const [maxProducts, setMaxProducts] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Active Job State
  const [currentJob, setCurrentJob] = useState<ScrapeJob | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Image Preview Modal State
  const [previewProduct, setPreviewProduct] = useState<ScrapedProduct | null>(null);

  // Products Data
  const [productsData, setProductsData] = useState<PaginatedProductsResponse>({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
    brands: [],
    categories: []
  });
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Scrape Jobs History
  const [historyJobs, setHistoryJobs] = useState<ScrapeJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quick URL Fill helpers
  const sampleUrls = [
    { label: 'Instant & Frozen Food', url: 'https://instamart.in/c/instant-and-frozen-food' },
    { label: 'Fast & Up (Brand)', url: 'https://instamart.in/b/fast-%26-up' },
    { label: 'Fruits & Vegetables', url: 'https://instamart.in/c/fruits-and-vegetables' },
    { label: 'Dairy, Bread & Eggs', url: 'https://instamart.in/c/dairy-bread-and-eggs' }
  ];

  // Load history on mount
  useEffect(() => {
    loadHistory();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const jobs = await api.listScrapeJobs();
      setHistoryJobs(jobs);
      // If no active job selected yet and history exists, select latest completed job
      if (!currentJob && jobs.length > 0) {
        selectJob(jobs[0]);
      }
    } catch (err) {
      console.error('Failed to load scrape history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStartScrape = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a valid product listing URL.');
      return;
    }

    setLoading(true);
    setIsScraping(true);
    setError('');

    try {
      const job = await api.startScrapeJob(url.trim(), maxProducts);
      setCurrentJob(job);
      setLoading(false);
      startPolling(job.id);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start scraping job.');
      setLoading(false);
      setIsScraping(false);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const job = await api.getScrapeJob(jobId);
        setCurrentJob(job);

        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsScraping(false);
          loadHistory();
          if (job.status === 'COMPLETED') {
            loadProducts(job.id, 1);
          } else if (job.error_message) {
            setError(job.error_message);
          }
        }
      } catch (err) {
        console.error('Error polling scrape job:', err);
      }
    }, 1500);
  };

  const selectJob = (job: ScrapeJob) => {
    setCurrentJob(job);
    setUrl(job.source_url);
    setSelectedBrand('');
    setSelectedCategory('');
    setSelectedAvailability('');
    setSearchTerm('');
    setSortBy('name_asc');
    setCurrentPage(1);
    loadProducts(job.id, 1);
  };

  const loadProducts = async (
    jobId: string,
    page: number = 1,
    search: string = searchTerm,
    brand: string = selectedBrand,
    category: string = selectedCategory,
    avail: string = selectedAvailability,
    sort: string = sortBy
  ) => {
    setLoadingProducts(true);
    try {
      const data = await api.getJobProducts(jobId, {
        page,
        limit: 50,
        search: search || undefined,
        brand: brand || undefined,
        category: category || undefined,
        availability: avail || undefined,
        sort_by: sort
      });
      setProductsData(data);
      setCurrentPage(data.page);
    } catch (err) {
      console.error('Failed to load products for job:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this scrape job and all its saved products?')) return;
    try {
      await api.deleteScrapeJob(jobId);
      if (currentJob?.id === jobId) {
        setCurrentJob(null);
        setProductsData({ items: [], total: 0, page: 1, pages: 1, brands: [], categories: [] });
      }
      loadHistory();
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  // Trigger search / filter changes
  const handleFilterChange = (
    newSearch = searchTerm,
    newBrand = selectedBrand,
    newCat = selectedCategory,
    newAvail = selectedAvailability,
    newSort = sortBy
  ) => {
    if (!currentJob) return;
    loadProducts(currentJob.id, 1, newSearch, newBrand, newCat, newAvail, newSort);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
            <ShoppingBag className="w-3.5 h-3.5" /> E-Commerce &amp; Grocery Extraction Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Product Scraper</span>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
              Instamart Ready
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Extract product listings, selling prices, MRP, discounts, pack sizes, and images from Instamart and e-commerce catalogs.
          </p>
        </div>

        {currentJob && currentJob.status === 'COMPLETED' && (
          <div className="flex items-center gap-2">
            <a
              href={api.getExportCsvUrl(currentJob.id)}
              download
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </a>
            <a
              href={api.getExportExcelUrl(currentJob.id)}
              download
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>Export Excel (.xlsx)</span>
            </a>
          </div>
        )}
      </div>

      {/* SCRAPER INPUT CARD */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 shadow-sm space-y-5">
        <form onSubmit={handleStartScrape} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Product Listing URL</span>
              <span className="text-slate-400 font-normal text-xs">(Category, Brand, or Collection page)</span>
            </label>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Max Products:</span>
              <select
                value={maxProducts}
                onChange={(e) => setMaxProducts(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://instamart.in/c/instant-and-frozen-food or https://instamart.in/b/fast-%26-up"
                required
                className="w-full pl-4 pr-4 py-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-indigo-600 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || isScraping}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
            >
              {loading || isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scraping Page...</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Start Scraping</span>
                </>
              )}
            </button>
          </div>

          {/* QUICK FILL BUTTONS */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-500">Quick Test URLs:</span>
            {sampleUrls.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setUrl(sample.url)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-xs font-medium transition-all"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </form>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
            <div className="space-y-1">
              <span className="font-bold">Scraping Notice:</span>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* LIVE PROGRESS STATUS BOX */}
      {(isScraping || (currentJob && currentJob.status !== 'COMPLETED' && currentJob.status !== 'FAILED')) && (
        <div className="bg-indigo-950 text-white border border-indigo-900 rounded-2xl p-6 shadow-lg space-y-4 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Live Scraping in Progress</h3>
                <p className="text-xs text-indigo-200">{currentJob?.source_url}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-800 text-indigo-200 text-xs font-bold uppercase tracking-wider animate-pulse">
              {currentJob?.status || 'SCRAPING'}
            </span>
          </div>

          {/* Progress message tracker */}
          <div className="bg-indigo-900/60 rounded-xl p-4 border border-indigo-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-200">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{currentJob?.progress_message || 'Initializing scraper engine...'}</span>
              </span>
              <span>{currentJob?.website || 'Instamart'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-indigo-800/60 text-xs">
              <div>
                <span className="text-indigo-300 block">URL Status</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Validated
                </span>
              </div>
              <div>
                <span className="text-indigo-300 block">Products Detected</span>
                <span className="font-bold text-white text-sm">{currentJob?.total_found || 0}</span>
              </div>
              <div>
                <span className="text-indigo-300 block">Products Extracted</span>
                <span className="font-bold text-emerald-300 text-sm">{currentJob?.total_saved || 0}</span>
              </div>
              <div>
                <span className="text-indigo-300 block">Duplicates Cleaned</span>
                <span className="font-bold text-amber-300 text-sm">{currentJob?.duplicates_removed || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JOB OVERVIEW & METRICS (When a job is completed) */}
      {currentJob && currentJob.status === 'COMPLETED' && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Scraping Completed
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 text-xs font-medium">
                  {currentJob.website}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white truncate max-w-2xl">
                {currentJob.source_url}
              </h2>
            </div>

            {/* Location context badge */}
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 border border-white/10 text-xs">
              <span className="text-slate-400 block text-[11px] font-medium">Price &amp; Inventory Context:</span>
              <div className="flex items-center gap-1.5 font-bold text-amber-300 mt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-xs">{currentJob.city || currentJob.location_context || 'Location detected: Default Region'}</span>
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-white/10">
            <div className="bg-white/5 rounded-xl p-3.5 border border-white/5">
              <span className="text-xs text-slate-400">Total Found</span>
              <p className="text-xl font-extrabold text-white mt-0.5">{currentJob.total_found}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-3.5 border border-emerald-500/20">
              <span className="text-xs text-emerald-300">Cleaned &amp; Saved</span>
              <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{currentJob.total_saved}</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-3.5 border border-amber-500/20">
              <span className="text-xs text-amber-300">Duplicates Removed</span>
              <p className="text-xl font-extrabold text-amber-400 mt-0.5">{currentJob.duplicates_removed}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3.5 border border-white/5">
              <span className="text-xs text-slate-400">Failed Records</span>
              <p className="text-xl font-extrabold text-slate-300 mt-0.5">{currentJob.total_failed || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTS TABLE SECTION */}
      {currentJob && currentJob.status === 'COMPLETED' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                <span>Scraped Products</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {productsData.total} items
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Filter, search, sort, and review structured catalog data.</p>
            </div>

            {/* Quick Export Actions */}
            <div className="flex items-center gap-2">
              <a
                href={api.getExportCsvUrl(currentJob.id)}
                download
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
              </a>
              <a
                href={api.getExportExcelUrl(currentJob.id)}
                download
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
              </a>
            </div>
          </div>

          {/* SEARCH, FILTERS & SORT CONTROLS */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Search Input */}
            <div className="sm:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleFilterChange(e.target.value, selectedBrand, selectedCategory, selectedAvailability, sortBy);
                }}
                placeholder="Search products by name..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Brand Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value);
                  handleFilterChange(searchTerm, e.target.value, selectedCategory, selectedAvailability, sortBy);
                }}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">All Brands</option>
                {productsData.brands.map((b, i) => (
                  <option key={i} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  handleFilterChange(searchTerm, selectedBrand, e.target.value, selectedAvailability, sortBy);
                }}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">All Categories</option>
                {productsData.categories.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedAvailability}
                onChange={(e) => {
                  setSelectedAvailability(e.target.value);
                  handleFilterChange(searchTerm, selectedBrand, selectedCategory, e.target.value, sortBy);
                }}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">All Stock</option>
                <option value="In Stock">In Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="sm:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  handleFilterChange(searchTerm, selectedBrand, selectedCategory, selectedAvailability, e.target.value);
                }}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="price_asc">Price (Low → High)</option>
                <option value="price_desc">Price (High → Low)</option>
                <option value="time_desc">Recently Scraped</option>
              </select>
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
            {loadingProducts ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                <p className="text-xs font-medium">Loading products table...</p>
              </div>
            ) : productsData.items.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">No matching products found</p>
                <p className="text-xs text-slate-400">Try adjusting your search query or filters.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm text-slate-700">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 w-16 text-center">Image</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-3">Brand</th>
                    <th className="py-3 px-3">Pack Size</th>
                    <th className="py-3 px-3 text-right">Selling Price</th>
                    <th className="py-3 px-3 text-right">MRP</th>
                    <th className="py-3 px-3 text-center">Discount</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {productsData.items.map((prod, idx) => {
                    const rowNum = (currentPage - 1) * 50 + idx + 1;
                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-3 text-center text-slate-400 font-medium text-xs">
                          {rowNum}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {prod.image_url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewProduct(prod)}
                              className="relative group/img w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden inline-flex items-center justify-center p-1 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer"
                              title="Click to view full photo"
                            >
                              <img
                                src={prod.image_url}
                                alt={prod.product_name}
                                className="w-full h-full object-contain group-hover/img:scale-110 transition-transform"
                                onError={(e) => { (e.target as any).style.display = 'none'; }}
                              />
                              <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                              <ImageIcon className="w-5 h-5 text-slate-300" />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {prod.product_name}
                            </div>
                            {prod.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={prod.description}>
                                {prod.description}
                              </p>
                            )}
                            {prod.category && (
                              <span className="text-[11px] text-slate-400 block mt-0.5">{prod.category}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-700">
                            {prod.brand || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap">
                            {prod.pack_size || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                            {prod.selling_price !== null && prod.selling_price !== undefined ? `₹${prod.selling_price}` : '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 line-through text-xs whitespace-nowrap">
                          {prod.mrp !== null && prod.mrp !== undefined && prod.mrp > (prod.selling_price || 0) ? `₹${prod.mrp}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {prod.discount ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold border border-emerald-200 whitespace-nowrap">
                              {prod.discount}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                            prod.availability?.toLowerCase().includes('in stock')
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {prod.availability}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <a
                            href={prod.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 inline-flex items-center justify-center transition-all"
                            title="View Product on Store"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION CONTROLS */}
          {productsData.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Page {productsData.page} of {productsData.pages} ({productsData.total} total items)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1 || loadingProducts}
                  onClick={() => {
                    const newPage = currentPage - 1;
                    setCurrentPage(newPage);
                    if (currentJob) loadProducts(currentJob.id, newPage);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                  {currentPage}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= productsData.pages || loadingProducts}
                  onClick={() => {
                    const newPage = currentPage + 1;
                    setCurrentPage(newPage);
                    if (currentJob) loadProducts(currentJob.id, newPage);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SCRAPE HISTORY SECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Scrape History</span>
            </h3>
            <p className="text-xs text-slate-500">Access previously scraped catalogs and export saved data.</p>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all text-xs font-semibold flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {historyJobs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No past scrape jobs found. Enter a product URL above to get started!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {historyJobs.map((job) => {
              const isSelected = currentJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => selectJob(job)}
                  className={`p-3.5 rounded-xl cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isSelected ? 'bg-indigo-50/80 border border-indigo-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {job.website}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : job.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}>
                        {job.status}
                      </span>
                      {job.city && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" /> {job.city}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate max-w-xl">{job.source_url}</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-right text-xs">
                      <span className="font-extrabold text-slate-900">{job.total_saved} Products</span>
                      <span className="text-slate-400 block text-[10px]">
                        {new Date(job.started_at).toLocaleDateString()} {new Date(job.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => selectJob(job)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isSelected ? 'Viewing' : 'View'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteJob(job.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                        title="Delete Scrape Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* IMAGE PREVIEW MODAL */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewProduct(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition-all shadow-md"
            >
              <X className="w-5 h-5" />
            </button>

            {/* High-Res Image Display */}
            <div className="bg-slate-50 p-8 flex items-center justify-center min-h-[300px] max-h-[380px] border-b border-slate-100 relative">
              {previewProduct.image_url ? (
                <img
                  src={previewProduct.image_url}
                  alt={previewProduct.product_name}
                  className="max-h-[300px] w-auto object-contain drop-shadow-md rounded-lg"
                />
              ) : (
                <div className="text-center text-slate-400 space-y-2">
                  <ImageIcon className="w-16 h-16 mx-auto stroke-1" />
                  <p className="text-xs">No image available for this item</p>
                </div>
              )}

              {previewProduct.discount && (
                <span className="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black shadow-md">
                  {previewProduct.discount}
                </span>
              )}
            </div>

            {/* Product Details */}
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {previewProduct.brand && (
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                      {previewProduct.brand}
                    </span>
                  )}
                  {previewProduct.pack_size && (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                      {previewProduct.pack_size}
                    </span>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    previewProduct.availability?.toLowerCase().includes('in stock')
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {previewProduct.availability}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                  {previewProduct.product_name}
                </h3>
                {previewProduct.category && (
                  <p className="text-xs text-slate-400 mt-0.5">Category: {previewProduct.category}</p>
                )}

                {/* Description (shown when available) */}
                {previewProduct.description && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Product Description</span>
                    <p className="text-xs text-slate-600 leading-relaxed max-h-28 overflow-y-auto">
                      {previewProduct.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Pricing breakdown */}
              <div className="flex items-baseline gap-3 pt-2 border-t border-slate-100">
                <span className="text-2xl font-black text-slate-900">
                  {previewProduct.selling_price !== null && previewProduct.selling_price !== undefined
                    ? `₹${previewProduct.selling_price}`
                    : 'Price unavailable'}
                </span>
                {previewProduct.mrp !== null && previewProduct.mrp !== undefined && previewProduct.mrp > (previewProduct.selling_price || 0) && (
                  <span className="text-sm text-slate-400 line-through">
                    ₹{previewProduct.mrp}
                  </span>
                )}
                {previewProduct.discount && (
                  <span className="text-xs font-bold text-emerald-600">
                    Save {previewProduct.discount}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                {previewProduct.image_url && (
                  <a
                    href={previewProduct.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>View / Download Photo</span>
                  </a>
                )}
                <a
                  href={previewProduct.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Store Link</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

