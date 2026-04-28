import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingUp, BookOpen, DollarSign, PiggyBank } from "lucide-react";
import { useState } from "react";

export default function FinancialTools() {
  // DTI Calculator state
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [monthlyDebts, setMonthlyDebts] = useState("");
  const [dtiRatio, setDtiRatio] = useState<number | null>(null);

  // Loan Comparison state
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate1, setInterestRate1] = useState("");
  const [term1, setTerm1] = useState("");
  const [interestRate2, setInterestRate2] = useState("");
  const [term2, setTerm2] = useState("");
  const [comparison, setComparison] = useState<any>(null);

  // Budget Calculator state
  const [income, setIncome] = useState("");
  const [housing, setHousing] = useState("");
  const [transportation, setTransportation] = useState("");
  const [food, setFood] = useState("");
  const [utilities, setUtilities] = useState("");
  const [otherExpenses, setOtherExpenses] = useState("");

  const calculateDTI = () => {
    const income = parseFloat(monthlyIncome);
    const debts = parseFloat(monthlyDebts);
    if (income && debts) {
      const ratio = (debts / income) * 100;
      setDtiRatio(ratio);
    }
  };

  const calculateLoanComparison = () => {
    const principal = parseFloat(loanAmount);
    const rate1 = parseFloat(interestRate1) / 100 / 12;
    const months1 = parseInt(term1) * 12;
    const rate2 = parseFloat(interestRate2) / 100 / 12;
    const months2 = parseInt(term2) * 12;

    if (principal && rate1 && months1 && rate2 && months2) {
      const payment1 = (principal * rate1 * Math.pow(1 + rate1, months1)) / (Math.pow(1 + rate1, months1) - 1);
      const totalPaid1 = payment1 * months1;
      const totalInterest1 = totalPaid1 - principal;

      const payment2 = (principal * rate2 * Math.pow(1 + rate2, months2)) / (Math.pow(1 + rate2, months2) - 1);
      const totalPaid2 = payment2 * months2;
      const totalInterest2 = totalPaid2 - principal;

      setComparison({
        option1: {
          monthlyPayment: payment1,
          totalPaid: totalPaid1,
          totalInterest: totalInterest1,
        },
        option2: {
          monthlyPayment: payment2,
          totalPaid: totalPaid2,
          totalInterest: totalInterest2,
        },
      });
    }
  };

  const getDTIMessage = (ratio: number) => {
    if (ratio <= 36) {
      return { color: "text-green-600", message: "Excellent! Your DTI is in the ideal range." };
    } else if (ratio <= 43) {
      return { color: "text-yellow-600", message: "Good, but consider reducing debt." };
    } else {
      return { color: "text-red-600", message: "High DTI. Focus on reducing debt." };
    }
  };

  const calculateBudget = () => {
    const totalIncome = parseFloat(income);
    const totalExpenses =
      parseFloat(housing || "0") +
      parseFloat(transportation || "0") +
      parseFloat(food || "0") +
      parseFloat(utilities || "0") +
      parseFloat(otherExpenses || "0");
    const remaining = totalIncome - totalExpenses;
    return { totalExpenses, remaining, percentUsed: (totalExpenses / totalIncome) * 100 };
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          Financial Literacy Tools
        </h1>
        <p className="text-muted-foreground">
          Use these tools to better understand your financial health and make informed decisions.
        </p>
      </div>

      <Tabs defaultValue="dti" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dti">DTI Calculator</TabsTrigger>
          <TabsTrigger value="comparison">Loan Comparison</TabsTrigger>
          <TabsTrigger value="budget">Budget Tool</TabsTrigger>
          <TabsTrigger value="education">Credit Education</TabsTrigger>
        </TabsList>

        {/* DTI Calculator */}
        <TabsContent value="dti">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold">Debt-to-Income (DTI) Ratio Calculator</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Your DTI ratio helps lenders determine how much you can afford to borrow. A lower ratio is better.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="income">Monthly Gross Income</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="income"
                      type="number"
                      step="0.01"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      className="pl-7"
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="debts">Total Monthly Debt Payments</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="debts"
                      type="number"
                      step="0.01"
                      value={monthlyDebts}
                      onChange={(e) => setMonthlyDebts(e.target.value)}
                      className="pl-7"
                      placeholder="1500"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Include: mortgage, car loans, credit cards, student loans, etc.
                  </p>
                </div>

                <Button onClick={calculateDTI} className="w-full">
                  Calculate DTI
                </Button>
              </div>

              <div className="flex items-center justify-center">
                {dtiRatio !== null ? (
                  <div className="text-center">
                    <div className="mb-4">
                      <p className="text-6xl font-bold text-primary">{dtiRatio.toFixed(1)}%</p>
                      <p className="text-muted-foreground mt-2">Your DTI Ratio</p>
                    </div>
                    <div className={`${getDTIMessage(dtiRatio).color} font-medium`}>
                      {getDTIMessage(dtiRatio).message}
                    </div>
                    <div className="mt-6 space-y-2 text-sm text-left bg-muted p-4 rounded-lg">
                      <p><strong>Ideal:</strong> Below 36%</p>
                      <p><strong>Good:</strong> 36% - 43%</p>
                      <p><strong>High:</strong> Above 43%</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Enter your income and debts to calculate</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Loan Comparison */}
        <TabsContent value="comparison">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold">Loan Comparison Calculator</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Compare two loan options to see which saves you more money.
            </p>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="loanAmount">Loan Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                  <Input
                    id="loanAmount"
                    type="number"
                    step="0.01"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="pl-7"
                    placeholder="10000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-4 bg-blue-50">
                  <h3 className="font-semibold mb-4">Option 1</h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="rate1">Interest Rate (%)</Label>
                      <Input
                        id="rate1"
                        type="number"
                        step="0.01"
                        value={interestRate1}
                        onChange={(e) => setInterestRate1(e.target.value)}
                        placeholder="5.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="term1">Term (years)</Label>
                      <Input
                        id="term1"
                        type="number"
                        value={term1}
                        onChange={(e) => setTerm1(e.target.value)}
                        placeholder="3"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-green-50">
                  <h3 className="font-semibold mb-4">Option 2</h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="rate2">Interest Rate (%)</Label>
                      <Input
                        id="rate2"
                        type="number"
                        step="0.01"
                        value={interestRate2}
                        onChange={(e) => setInterestRate2(e.target.value)}
                        placeholder="6.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="term2">Term (years)</Label>
                      <Input
                        id="term2"
                        type="number"
                        value={term2}
                        onChange={(e) => setTerm2(e.target.value)}
                        placeholder="5"
                      />
                    </div>
                  </div>
                </Card>
              </div>

              <Button onClick={calculateLoanComparison} className="w-full">
                Compare Loans
              </Button>

              {comparison && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <Card className="p-4 border-2 border-blue-200">
                    <h3 className="font-semibold mb-3">Option 1 Results</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Monthly Payment:</span>
                        <span className="font-medium">
                          ${comparison.option1.monthlyPayment.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Paid:</span>
                        <span className="font-medium">
                          ${comparison.option1.totalPaid.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Interest:</span>
                        <span className="font-medium text-red-600">
                          ${comparison.option1.totalInterest.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 border-2 border-green-200">
                    <h3 className="font-semibold mb-3">Option 2 Results</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Monthly Payment:</span>
                        <span className="font-medium">
                          ${comparison.option2.monthlyPayment.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Paid:</span>
                        <span className="font-medium">
                          ${comparison.option2.totalPaid.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Interest:</span>
                        <span className="font-medium text-red-600">
                          ${comparison.option2.totalInterest.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Budget Tool */}
        <TabsContent value="budget">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <PiggyBank className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold">Monthly Budget Calculator</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Track your income and expenses to see where your money goes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyIncome">Monthly Income</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="monthlyIncome"
                      type="number"
                      step="0.01"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      className="pl-7"
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="housing">Housing</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="housing"
                      type="number"
                      step="0.01"
                      value={housing}
                      onChange={(e) => setHousing(e.target.value)}
                      className="pl-7"
                      placeholder="1200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transportation">Transportation</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="transportation"
                      type="number"
                      step="0.01"
                      value={transportation}
                      onChange={(e) => setTransportation(e.target.value)}
                      className="pl-7"
                      placeholder="400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="food">Food & Groceries</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="food"
                      type="number"
                      step="0.01"
                      value={food}
                      onChange={(e) => setFood(e.target.value)}
                      className="pl-7"
                      placeholder="500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="utilities">Utilities</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="utilities"
                      type="number"
                      step="0.01"
                      value={utilities}
                      onChange={(e) => setUtilities(e.target.value)}
                      className="pl-7"
                      placeholder="200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="other">Other Expenses</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="other"
                      type="number"
                      step="0.01"
                      value={otherExpenses}
                      onChange={(e) => setOtherExpenses(e.target.value)}
                      className="pl-7"
                      placeholder="300"
                    />
                  </div>
                </div>
              </div>

              <div>
                {income && (
                  <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
                    <h3 className="font-semibold mb-4">Budget Summary</h3>
                    {(() => {
                      const { totalExpenses, remaining, percentUsed } = calculateBudget();
                      return (
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Monthly Income</p>
                            <p className="text-2xl font-bold">${parseFloat(income).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Expenses</p>
                            <p className="text-2xl font-bold">${totalExpenses.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Remaining</p>
                            <p className={`text-2xl font-bold ${remaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                              ${remaining.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Budget Usage</p>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                              <div
                                className={`h-4 rounded-full transition-all ${
                                  percentUsed > 100
                                    ? "bg-red-500"
                                    : percentUsed > 80
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                }`}
                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {percentUsed.toFixed(1)}% of income used
                            </p>
                          </div>
                          <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground">
                              {remaining >= 0
                                ? "Great job! You have money left over for savings."
                                : "You're spending more than you earn. Consider reducing expenses."}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Credit Education */}
        <TabsContent value="education">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold">Understanding Credit Scores</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">What is a Credit Score?</h3>
                  <p className="text-sm text-muted-foreground">
                    A credit score is a three-digit number (300-850) that represents your creditworthiness. 
                    Lenders use it to determine if you're likely to repay borrowed money.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Credit Score Ranges</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium">800-850</div>
                      <div className="flex-1 bg-green-100 p-2 rounded">Exceptional</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium">740-799</div>
                      <div className="flex-1 bg-blue-100 p-2 rounded">Very Good</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium">670-739</div>
                      <div className="flex-1 bg-yellow-100 p-2 rounded">Good</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium">580-669</div>
                      <div className="flex-1 bg-orange-100 p-2 rounded">Fair</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium">300-579</div>
                      <div className="flex-1 bg-red-100 p-2 rounded">Poor</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4">Factors That Affect Your Score</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-16 text-2xl font-bold text-primary">35%</div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Payment History</h3>
                    <p className="text-sm text-muted-foreground">
                      Making payments on time is the most important factor
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-16 text-2xl font-bold text-primary">30%</div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Credit Utilization</h3>
                    <p className="text-sm text-muted-foreground">
                      Keep credit card balances below 30% of your limit
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-16 text-2xl font-bold text-primary">15%</div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Length of Credit History</h3>
                    <p className="text-sm text-muted-foreground">
                      Longer credit history is better
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-16 text-2xl font-bold text-primary">10%</div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Credit Mix</h3>
                    <p className="text-sm text-muted-foreground">
                      Having different types of credit (cards, loans, etc.)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-16 text-2xl font-bold text-primary">10%</div>
                  <div className="flex-1">
                    <h3 className="font-semibold">New Credit</h3>
                    <p className="text-sm text-muted-foreground">
                      Avoid opening too many accounts at once
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-primary/5">
              <h2 className="text-2xl font-semibold mb-4">Tips to Improve Your Credit</h2>
              <ul className="space-y-2 list-disc list-inside text-sm">
                <li>Pay all bills on time, every time</li>
                <li>Keep credit card balances low (under 30% of limit)</li>
                <li>Don't close old credit cards</li>
                <li>Only apply for credit when necessary</li>
                <li>Check your credit report regularly for errors</li>
                <li>Diversify your credit types over time</li>
                <li>Set up automatic payments to avoid missing due dates</li>
              </ul>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
