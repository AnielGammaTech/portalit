import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Contracts from './pages/Contracts';
import SaaSManagement from './pages/SaaSManagement';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Adminland from './pages/Adminland';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Customers": Customers,
    "CustomerDetail": CustomerDetail,
    "Contracts": Contracts,
    "SaaSManagement": SaaSManagement,
    "Integrations": Integrations,
    "Settings": Settings,
    "Adminland": Adminland,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};