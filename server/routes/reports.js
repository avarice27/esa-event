const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get profit & loss report
router.get('/profit-loss', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, eventId } = req.query;
    
    let whereClause = `WHERE (e.created_by = $1 OR $2 IN ('admin', 'manager')) AND t.status = 'completed'`;
    let params = [req.user.id, req.user.role];
    let paramCount = 2;

    if (startDate) {
      whereClause += ` AND t.transaction_date >= $${++paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND t.transaction_date <= $${++paramCount}`;
      params.push(endDate);
    }

    if (eventId) {
      whereClause += ` AND t.event_id = $${++paramCount}`;
      params.push(eventId);
    }

    // Get income and expense totals by category
    const categoryResult = await query(`
      SELECT 
        t.type,
        t.category,
        SUM(t.amount) as total_amount,
        COUNT(t.id) as transaction_count
      FROM transactions t
      JOIN events e ON t.event_id = e.id
      ${whereClause}
      GROUP BY t.type, t.category
      ORDER BY t.type, total_amount DESC
    `, params);

    // Get monthly breakdown
    const monthlyResult = await query(`
      SELECT 
        DATE_TRUNC('month', t.transaction_date) as month,
        t.type,
        SUM(t.amount) as total_amount
      FROM transactions t
      JOIN events e ON t.event_id = e.id
      ${whereClause}
      GROUP BY DATE_TRUNC('month', t.transaction_date), t.type
      ORDER BY month DESC, t.type
    `, params);

    // Get summary totals
    const summaryResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
        COUNT(CASE WHEN t.type = 'income' THEN 1 END) as income_transactions,
        COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_transactions
      FROM transactions t
      JOIN events e ON t.event_id = e.id
      ${whereClause}
    `, params);

    const summary = summaryResult.rows[0];
    const totalIncome = parseFloat(summary.total_income);
    const totalExpenses = parseFloat(summary.total_expenses);
    const netProfit = totalIncome - totalExpenses;

    // Group categories by type
    const incomeCategories = categoryResult.rows
      .filter(row => row.type === 'income')
      .map(row => ({
        category: row.category,
        amount: parseFloat(row.total_amount),
        transactionCount: parseInt(row.transaction_count),
        percentage: totalIncome > 0 ? ((parseFloat(row.total_amount) / totalIncome) * 100).toFixed(2) : 0
      }));

    const expenseCategories = categoryResult.rows
      .filter(row => row.type === 'expense')
      .map(row => ({
        category: row.category,
        amount: parseFloat(row.total_amount),
        transactionCount: parseInt(row.transaction_count),
        percentage: totalExpenses > 0 ? ((parseFloat(row.total_amount) / totalExpenses) * 100).toFixed(2) : 0
      }));

    // Group monthly data
    const monthlyData = {};
    monthlyResult.rows.forEach(row => {
      const month = row.month;
      if (!monthlyData[month]) {
        monthlyData[month] = { month, income: 0, expenses: 0 };
      }
      monthlyData[month][row.type === 'income' ? 'income' : 'expenses'] = parseFloat(row.total_amount);
    });

    const monthlyBreakdown = Object.values(monthlyData).map(data => ({
      ...data,
      profit: data.income - data.expenses
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome,
          totalExpenses,
          netProfit,
          profitMargin: totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0,
          incomeTransactions: parseInt(summary.income_transactions),
          expenseTransactions: parseInt(summary.expense_transactions)
        },
        incomeCategories,
        expenseCategories,
        monthlyBreakdown
      }
    });
  } catch (error) {
    console.error('Profit & Loss report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate profit & loss report'
    });
  }
});

// Get budget variance report
router.get('/budget-variance', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.query;
    
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required for budget variance report'
      });
    }

    // Verify event access
    const eventCheck = await query(
      'SELECT id, name, budget FROM events WHERE id = $1 AND (created_by = $2 OR $3 IN (\'admin\', \'manager\'))',
      [eventId, req.user.id, req.user.role]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    const event = eventCheck.rows[0];

    // Get budget vs actual by category
    const budgetResult = await query(`
      SELECT 
        bc.name as category_name,
        bc.type as category_type,
        eb.budgeted_amount,
        COALESCE(SUM(t.amount), 0) as actual_amount
      FROM budget_categories bc
      LEFT JOIN event_budgets eb ON bc.id = eb.category_id AND eb.event_id = $1
      LEFT JOIN transactions t ON t.event_id = $1 AND t.category = bc.name AND t.type = bc.type AND t.status = 'completed'
      WHERE eb.budgeted_amount IS NOT NULL OR SUM(t.amount) > 0
      GROUP BY bc.id, bc.name, bc.type, eb.budgeted_amount
      ORDER BY bc.type, bc.name
    `, [eventId]);

    // Get overall budget summary
    const summaryResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN bc.type = 'income' THEN eb.budgeted_amount ELSE 0 END), 0) as budgeted_income,
        COALESCE(SUM(CASE WHEN bc.type = 'expense' THEN eb.budgeted_amount ELSE 0 END), 0) as budgeted_expenses,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as actual_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as actual_expenses
      FROM event_budgets eb
      JOIN budget_categories bc ON eb.category_id = bc.id
      LEFT JOIN transactions t ON t.event_id = eb.event_id AND t.category = bc.name AND t.type = bc.type AND t.status = 'completed'
      WHERE eb.event_id = $1
    `, [eventId]);

    const summary = summaryResult.rows[0] || {
      budgeted_income: 0,
      budgeted_expenses: 0,
      actual_income: 0,
      actual_expenses: 0
    };

    const budgetedIncome = parseFloat(summary.budgeted_income);
    const budgetedExpenses = parseFloat(summary.budgeted_expenses);
    const actualIncome = parseFloat(summary.actual_income);
    const actualExpenses = parseFloat(summary.actual_expenses);

    const budgetedProfit = budgetedIncome - budgetedExpenses;
    const actualProfit = actualIncome - actualExpenses;

    const categories = budgetResult.rows.map(row => {
      const budgeted = parseFloat(row.budgeted_amount || 0);
      const actual = parseFloat(row.actual_amount || 0);
      const variance = actual - budgeted;
      const variancePercent = budgeted > 0 ? ((variance / budgeted) * 100).toFixed(2) : 0;

      return {
        categoryName: row.category_name,
        categoryType: row.category_type,
        budgetedAmount: budgeted,
        actualAmount: actual,
        variance,
        variancePercent: parseFloat(variancePercent),
        status: variance > 0 ? 'over' : variance < 0 ? 'under' : 'on_target'
      };
    });

    res.json({
      success: true,
      data: {
        event: {
          id: event.id,
          name: event.name,
          totalBudget: parseFloat(event.budget || 0)
        },
        summary: {
          budgetedIncome,
          budgetedExpenses,
          budgetedProfit,
          actualIncome,
          actualExpenses,
          actualProfit,
          incomeVariance: actualIncome - budgetedIncome,
          expenseVariance: actualExpenses - budgetedExpenses,
          profitVariance: actualProfit - budgetedProfit
        },
        categories
      }
    });
  } catch (error) {
    console.error('Budget variance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate budget variance report'
    });
  }
});

// Get cash flow report
router.get('/cash-flow', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, period = 'monthly' } = req.query;
    
    let dateFormat;
    switch (period) {
      case 'daily':
        dateFormat = 'day';
        break;
      case 'weekly':
        dateFormat = 'week';
        break;
      case 'monthly':
      default:
        dateFormat = 'month';
        break;
    }

    let whereClause = `WHERE (e.created_by = $1 OR $2 IN ('admin', 'manager')) AND t.status = 'completed'`;
    let params = [req.user.id, req.user.role];
    let paramCount = 2;

    if (startDate) {
      whereClause += ` AND t.transaction_date >= $${++paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND t.transaction_date <= $${++paramCount}`;
      params.push(endDate);
    }

    const cashFlowResult = await query(`
      SELECT 
        DATE_TRUNC('${dateFormat}', t.transaction_date) as period,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as cash_in,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as cash_out,
        COUNT(CASE WHEN t.type = 'income' THEN 1 END) as income_count,
        COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_count
      FROM transactions t
      JOIN events e ON t.event_id = e.id
      ${whereClause}
      GROUP BY DATE_TRUNC('${dateFormat}', t.transaction_date)
      ORDER BY period DESC
    `, params);

    let runningBalance = 0;
    const cashFlowData = cashFlowResult.rows.reverse().map(row => {
      const cashIn = parseFloat(row.cash_in);
      const cashOut = parseFloat(row.cash_out);
      const netCashFlow = cashIn - cashOut;
      runningBalance += netCashFlow;

      return {
        period: row.period,
        cashIn,
        cashOut,
        netCashFlow,
        runningBalance,
        incomeCount: parseInt(row.income_count),
        expenseCount: parseInt(row.expense_count)
      };
    }).reverse();

    // Get summary statistics
    const totalCashIn = cashFlowData.reduce((sum, row) => sum + row.cashIn, 0);
    const totalCashOut = cashFlowData.reduce((sum, row) => sum + row.cashOut, 0);
    const netCashFlow = totalCashIn - totalCashOut;

    res.json({
      success: true,
      data: {
        summary: {
          totalCashIn,
          totalCashOut,
          netCashFlow,
          finalBalance: runningBalance,
          periods: cashFlowData.length
        },
        cashFlowData
      }
    });
  } catch (error) {
    console.error('Cash flow report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate cash flow report'
    });
  }
});

// Get event profitability report
router.get('/event-profitability', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let whereClause = `WHERE (e.created_by = $1 OR $2 IN ('admin', 'manager'))`;
    let params = [req.user.id, req.user.role];
    let paramCount = 2;

    if (startDate) {
      whereClause += ` AND e.event_date >= $${++paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND e.event_date <= $${++paramCount}`;
      params.push(endDate);
    }

    if (status) {
      whereClause += ` AND e.status = $${++paramCount}`;
      params.push(status);
    }

    const profitabilityResult = await query(`
      SELECT 
        e.id,
        e.name,
        e.event_date,
        e.status,
        e.budget,
        COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0) as total_expenses,
        COUNT(CASE WHEN t.type = 'income' AND t.status = 'completed' THEN 1 END) as revenue_transactions,
        COUNT(CASE WHEN t.type = 'expense' AND t.status = 'completed' THEN 1 END) as expense_transactions,
        COUNT(DISTINCT t.client_id) as unique_clients,
        COUNT(DISTINCT t.vendor_id) as unique_vendors
      FROM events e
      LEFT JOIN transactions t ON e.id = t.event_id
      ${whereClause}
      GROUP BY e.id, e.name, e.event_date, e.status, e.budget
      ORDER BY e.event_date DESC
    `, params);

    const events = profitabilityResult.rows.map(row => {
      const budget = parseFloat(row.budget || 0);
      const revenue = parseFloat(row.total_revenue);
      const expenses = parseFloat(row.total_expenses);
      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : 0;
      const budgetVariance = budget > 0 ? expenses - budget : 0;
      const roi = budget > 0 ? ((profit / budget) * 100).toFixed(2) : 0;

      return {
        id: row.id,
        name: row.name,
        eventDate: row.event_date,
        status: row.status,
        budget,
        revenue,
        expenses,
        profit,
        profitMargin: parseFloat(profitMargin),
        budgetVariance,
        roi: parseFloat(roi),
        revenueTransactions: parseInt(row.revenue_transactions),
        expenseTransactions: parseInt(row.expense_transactions),
        uniqueClients: parseInt(row.unique_clients),
        uniqueVendors: parseInt(row.unique_vendors)
      };
    });

    // Calculate summary statistics
    const totalEvents = events.length;
    const totalRevenue = events.reduce((sum, event) => sum + event.revenue, 0);
    const totalExpenses = events.reduce((sum, event) => sum + event.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const avgProfitMargin = events.length > 0 
      ? (events.reduce((sum, event) => sum + event.profitMargin, 0) / events.length).toFixed(2)
      : 0;

    const profitableEvents = events.filter(event => event.profit > 0).length;
    const lossEvents = events.filter(event => event.profit < 0).length;

    res.json({
      success: true,
      data: {
        summary: {
          totalEvents,
          totalRevenue,
          totalExpenses,
          totalProfit,
          avgProfitMargin: parseFloat(avgProfitMargin),
          profitableEvents,
          lossEvents,
          profitabilityRate: totalEvents > 0 ? ((profitableEvents / totalEvents) * 100).toFixed(2) : 0
        },
        events
      }
    });
  } catch (error) {
    console.error('Event profitability report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate event profitability report'
    });
  }
});

// Get custom report data
router.post('/custom', authenticateToken, async (req, res) => {
  try {
    const { 
      reportType, 
      startDate, 
      endDate, 
      eventIds, 
      clientIds, 
      vendorIds,
      categories,
      groupBy = 'month'
    } = req.body;

    let baseQuery = `
      FROM transactions t
      JOIN events e ON t.event_id = e.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN vendors v ON t.vendor_id = v.id
      WHERE (e.created_by = $1 OR $2 IN ('admin', 'manager')) AND t.status = 'completed'
    `;
    
    let params = [req.user.id, req.user.role];
    let paramCount = 2;

    if (startDate) {
      baseQuery += ` AND t.transaction_date >= $${++paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      baseQuery += ` AND t.transaction_date <= $${++paramCount}`;
      params.push(endDate);
    }

    if (eventIds && eventIds.length > 0) {
      baseQuery += ` AND t.event_id = ANY($${++paramCount})`;
      params.push(eventIds);
    }

    if (clientIds && clientIds.length > 0) {
      baseQuery += ` AND t.client_id = ANY($${++paramCount})`;
      params.push(clientIds);
    }

    if (vendorIds && vendorIds.length > 0) {
      baseQuery += ` AND t.vendor_id = ANY($${++paramCount})`;
      params.push(vendorIds);
    }

    if (categories && categories.length > 0) {
      baseQuery += ` AND t.category = ANY($${++paramCount})`;
      params.push(categories);
    }

    let groupByClause;
    switch (groupBy) {
      case 'day':
        groupByClause = "DATE_TRUNC('day', t.transaction_date)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', t.transaction_date)";
        break;
      case 'month':
      default:
        groupByClause = "DATE_TRUNC('month', t.transaction_date)";
        break;
      case 'event':
        groupByClause = "e.id, e.name";
        break;
      case 'client':
        groupByClause = "c.id, c.company_name";
        break;
      case 'vendor':
        groupByClause = "v.id, v.company_name";
        break;
      case 'category':
        groupByClause = "t.category, t.type";
        break;
    }

    const reportQuery = `
      SELECT 
        ${groupByClause} as group_key,
        ${groupBy === 'event' ? 'e.name' : groupBy === 'client' ? 'c.company_name' : groupBy === 'vendor' ? 'v.company_name' : 'NULL'} as group_name,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
        COUNT(CASE WHEN t.type = 'income' THEN 1 END) as income_count,
        COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_count,
        COUNT(*) as total_transactions
      ${baseQuery}
      GROUP BY ${groupByClause}
      ORDER BY group_key DESC
    `;

    const result = await query(reportQuery, params);

    const reportData = result.rows.map(row => ({
      groupKey: row.group_key,
      groupName: row.group_name,
      totalIncome: parseFloat(row.total_income),
      totalExpenses: parseFloat(row.total_expenses),
      netProfit: parseFloat(row.total_income) - parseFloat(row.total_expenses),
      incomeCount: parseInt(row.income_count),
      expenseCount: parseInt(row.expense_count),
      totalTransactions: parseInt(row.total_transactions)
    }));

    // Calculate summary
    const summary = {
      totalIncome: reportData.reduce((sum, row) => sum + row.totalIncome, 0),
      totalExpenses: reportData.reduce((sum, row) => sum + row.totalExpenses, 0),
      totalTransactions: reportData.reduce((sum, row) => sum + row.totalTransactions, 0),
      groups: reportData.length
    };
    summary.netProfit = summary.totalIncome - summary.totalExpenses;

    res.json({
      success: true,
      data: {
        summary,
        reportData,
        parameters: {
          reportType,
          startDate,
          endDate,
          groupBy,
          filters: {
            eventIds,
            clientIds,
            vendorIds,
            categories
          }
        }
      }
    });
  } catch (error) {
    console.error('Custom report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate custom report'
    });
  }
});

module.exports = router;