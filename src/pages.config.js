import Adminland from './pages/Adminland';
import Analytics from './pages/Analytics';
import Contracts from './pages/Contracts';
import CustomerDetail from './pages/CustomerDetail';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Integrations from './pages/Integrations';
import LicenseDetail from './pages/LicenseDetail';
import SaaSReports from './pages/SaaSReports';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Adminland": Adminland,
    "Analytics": Analytics,
    "Contracts": Contracts,
    "CustomerDetail": CustomerDetail,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "Integrations": Integrations,
    "LicenseDetail": LicenseDetail,
    "SaaSReports": SaaSReports,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};