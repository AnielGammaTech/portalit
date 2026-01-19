import CustomerDetail from './pages/CustomerDetail';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Integrations from './pages/Integrations';
import LicenseDetail from './pages/LicenseDetail';
import Settings from './pages/Settings';
import SaaSReports from './pages/SaaSReports';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CustomerDetail": CustomerDetail,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "Integrations": Integrations,
    "LicenseDetail": LicenseDetail,
    "Settings": Settings,
    "SaaSReports": SaaSReports,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};