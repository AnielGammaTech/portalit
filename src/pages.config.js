/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Adminland from './pages/Adminland';
import Analytics from './pages/Analytics';
import AwaitingAccess from './pages/AwaitingAccess';
import Billing from './pages/Billing';
import Contracts from './pages/Contracts';
import CustomerDetail from './pages/CustomerDetail';
import CustomerPortalPreview from './pages/CustomerPortalPreview';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Integrations from './pages/Integrations';
import LicenseDetail from './pages/LicenseDetail';
import Loot from './pages/Loot';
import LootCustomer from './pages/LootCustomer';
import LootSettings from './pages/LootSettings';
import SaaSReports from './pages/SaaSReports';
import Services from './pages/Services';
import Settings from './pages/Settings';
import SpendAnalysis from './pages/SpendAnalysis';
import CustomerSettings from './pages/CustomerSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Adminland": Adminland,
    "Analytics": Analytics,
    "AwaitingAccess": AwaitingAccess,
    "Billing": Billing,
    "Contracts": Contracts,
    "CustomerDetail": CustomerDetail,
    "CustomerPortalPreview": CustomerPortalPreview,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "Integrations": Integrations,
    "LicenseDetail": LicenseDetail,
    "Loot": Loot,
    "LootCustomer": LootCustomer,
    "LootSettings": LootSettings,
    "SaaSReports": SaaSReports,
    "Services": Services,
    "Settings": Settings,
    "SpendAnalysis": SpendAnalysis,
    "CustomerSettings": CustomerSettings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};