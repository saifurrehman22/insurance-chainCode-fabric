package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing an insurance policy
type SmartContract struct {
	contractapi.Contract
}

// PolicyStatus represents the status of an insurance policy
type PolicyStatus string

const (
	Active    PolicyStatus = "Active"
	Cancelled PolicyStatus = "Cancelled"
	Claimed   PolicyStatus = "Claimed"
	Expired   PolicyStatus = "Expired"
)

// Policy describes basic details of what makes up an insurance policy
type Policy struct {
	ID                int          `json:"ID"`
	HolderName        string       `json:"HolderName"`
	Age               int          `json:"Age"`
	PolicyType        string       `json:"PolicyType"`
	Premium           float64      `json:"Premium"`
	Coverage          float64      `json:"Coverage"`
	EffectiveDate     string       `json:"EffectiveDate"`
	ExpirationDate    string       `json:"ExpirationDate"`
	TotalPaid         float64      `json:"TotalPaid"`
	PaymentCount      int          `json:"PaymentCount"`
	LastPaymentTime   time.Time    `json:"LastPaymentTime"`
	UserBalance       float64      `json:"UserBalance"`
	PolicyStatus      PolicyStatus `json:"PolicyStatus"`
	InstallmentNo     int          `json:"InstallmentNo"`
	TotalPremiumToPay float64      `json:"TotalPremiumToPay"`
}

const counterKey = "policyCounter"

// InitLedger initializes the ledger without predefined policies
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	// Initialize the counter with 0 since no predefined policies are added
	if err := ctx.GetStub().PutState(counterKey, []byte(strconv.Itoa(0))); err != nil {
		return fmt.Errorf("failed to initialize counter: %v", err)
	}
	return nil
}

func (s *SmartContract) GetInstallmentNo(ctx contractapi.TransactionContextInterface, id int) (int, error) {
	// Retrieve the policy
	policy, err := s.ReadPolicy(ctx, id)
	if err != nil {
		return 0, err
	}

	return policy.InstallmentNo, nil
}

func (s *SmartContract) SetInstallmentNo(ctx contractapi.TransactionContextInterface, id int, newInstallmentNo int) error {
	if newInstallmentNo <= 0 {
		return fmt.Errorf("installment number must be greater than zero")
	}

	// Retrieve the policy
	policy, err := s.ReadPolicy(ctx, id)
	if err != nil {
		return err
	}

	// Update the InstallmentNo field
	policy.InstallmentNo = newInstallmentNo

	// Marshal the updated policy to JSON
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	// Store the updated policy in the ledger
	return ctx.GetStub().PutState(strconv.Itoa(id), policyJSON)
}

func (s *SmartContract) getNextID(ctx contractapi.TransactionContextInterface) (int, error) {
	counterBytes, err := ctx.GetStub().GetState(counterKey)
	if err != nil {
		return 0, fmt.Errorf("failed to get counter: %v", err)
	}

	if counterBytes == nil {
		return 0, fmt.Errorf("counter does not exist")
	}

	counter, err := strconv.Atoi(string(counterBytes))
	if err != nil {
		return 0, fmt.Errorf("failed to convert counter to int: %v", err)
	}

	// Increment the counter
	counter++
	if err := ctx.GetStub().PutState(counterKey, []byte(strconv.Itoa(counter))); err != nil {
		return 0, fmt.Errorf("failed to update counter: %v", err)
	}

	return counter, nil
}

// CreateHealthInsurancePolicy adds a new health insurance policy to the ledger
func (s *SmartContract) CreateHealthInsurancePolicy(ctx contractapi.TransactionContextInterface, holderName string, age int, premium float64, coverage float64, installmentNo int, totalPremiumToPay float64) error {
	id, err := s.getNextID(ctx)
	if err != nil {
		return err
	}

	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	effectiveDate := time.Unix(timestamp.Seconds, int64(timestamp.Nanos))
	expirationDate := effectiveDate.Add(5 * time.Minute)

	policy := Policy{
		ID:                id,
		HolderName:        holderName,
		Age:               age,
		PolicyType:        "Health",
		Premium:           premium,
		Coverage:          coverage,
		EffectiveDate:     effectiveDate.Format(time.RFC3339),
		ExpirationDate:    expirationDate.Format(time.RFC3339),
		TotalPaid:         0,
		PolicyStatus:      Active,
		InstallmentNo:     installmentNo,
		TotalPremiumToPay: totalPremiumToPay,
	}
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(strconv.Itoa(id), policyJSON)
}

// CreateLifeInsurancePolicy adds a new life insurance policy to the ledger
func (s *SmartContract) CreateLifeInsurancePolicy(ctx contractapi.TransactionContextInterface, holderName string, age int, premium float64, coverage float64, installmentNo int, totalPremiumToPay float64) error {
	id, err := s.getNextID(ctx)
	if err != nil {
		return err
	}

	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	effectiveDate := time.Unix(timestamp.Seconds, int64(timestamp.Nanos))
	expirationDate := effectiveDate.Add(5 * time.Minute)

	policy := Policy{
		ID:                id,
		HolderName:        holderName,
		Age:               age,
		PolicyType:        "Life",
		Premium:           premium,
		Coverage:          coverage,
		EffectiveDate:     effectiveDate.Format(time.RFC3339),
		ExpirationDate:    expirationDate.Format(time.RFC3339),
		TotalPaid:         0,
		PolicyStatus:      Active,
		InstallmentNo:     installmentNo,
		TotalPremiumToPay: totalPremiumToPay,
	}
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(strconv.Itoa(id), policyJSON)
}

// ReadPolicy returns the policy stored in the ledger with the given id
func (s *SmartContract) ReadPolicy(ctx contractapi.TransactionContextInterface, id int) (*Policy, error) {
	policyJSON, err := ctx.GetStub().GetState(strconv.Itoa(id))
	if err != nil {
		return nil, fmt.Errorf("failed to read policy %d: %v", id, err)
	}
	if policyJSON == nil {
		return nil, fmt.Errorf("policy %d does not exist", id)
	}

	var policy Policy
	err = json.Unmarshal(policyJSON, &policy)
	if err != nil {
		return nil, err
	}

	return &policy, nil
}

// UpdatePolicy updates an existing policy in the ledger
func (s *SmartContract) UpdatePolicy(ctx contractapi.TransactionContextInterface, id int, holderName string, policyType string, premium float64, coverage float64, installmentNo int, totalPremiumToPay float64) error {
	policy, err := s.ReadPolicy(ctx, id)
	if err != nil {
		return err
	}

	policy.HolderName = holderName
	policy.PolicyType = policyType
	policy.Premium = premium
	policy.Coverage = coverage
	policy.InstallmentNo = installmentNo
	policy.TotalPremiumToPay = totalPremiumToPay
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(strconv.Itoa(id), policyJSON)
}

// DeletePolicy removes a policy key-value pair from the ledger
func (s *SmartContract) DeletePolicy(ctx contractapi.TransactionContextInterface, id int) error {
	return ctx.GetStub().DelState(strconv.Itoa(id))
}

// PayPremium allows a user to pay a specified amount towards their premium
func (s *SmartContract) PayPremium(ctx contractapi.TransactionContextInterface, id int, amount float64) error {
	// Retrieve the policy
	policy, err := s.ReadPolicy(ctx, id)
	if err != nil {
		return err
	}

	// Check if the policy is active
	if policy.PolicyStatus != Active {
		return fmt.Errorf("cannot pay premium on a policy that is not active")
	}

	// Check if the policy is eligible for payment based on the time interval and maximum payment count
	if policy.PaymentCount >= policy.InstallmentNo {
		return fmt.Errorf("maximum number of premium payments reached")
	}

	if amount <= 0 {
		return fmt.Errorf("payment amount must be greater than zero")
	}

	// Check if the last payment time is set
	if !policy.LastPaymentTime.IsZero() {
		// Calculate the time elapsed since the last payment
		elapsedTime := time.Since(policy.LastPaymentTime)

		// Check if the elapsed time is less than 10 Second
		if elapsedTime < 10*time.Second {
			return fmt.Errorf("payment can only be made after 10 Second")
		}
	}

	// Update the TotalPaid field
	policy.TotalPaid += amount
	policy.PaymentCount++

	// Update the last payment time to the transaction timestamp
	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	// Convert the protobuf timestamp to Go time.Time
	txTime := time.Unix(timestamp.Seconds, int64(timestamp.Nanos))
	policy.LastPaymentTime = txTime

	// Marshal the updated policy to JSON
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	// Store the updated policy in the ledger
	err = ctx.GetStub().PutState(strconv.Itoa(id), policyJSON)
	if err != nil {
		return err
	}

	return nil
}

func (s *SmartContract) ClaimCoverage(ctx contractapi.TransactionContextInterface, id int) error {
	// Retrieve the policy
	policy, err := s.ReadPolicy(ctx, id)
	if err != nil {
		return err
	}

	// Check if the policy has already been claimed
	if policy.PolicyStatus == Claimed {
		return fmt.Errorf("coverage for this policy has already been claimed")
	}

	// Check if the total paid amount exceeds the TotalPremiumToPay
	if policy.TotalPaid >= policy.TotalPremiumToPay {

		// Transfer coverage amount to the user's balance
		policy.UserBalance += policy.Coverage

		// Update policy status to Claimed
		policy.PolicyStatus = Claimed

		// Marshal the updated policy to JSON
		policyJSON, err := json.Marshal(policy)
		if err != nil {
			return err
		}
		// Store the updated policy in the ledger
		err = ctx.GetStub().PutState(strconv.Itoa(id), policyJSON)
		if err != nil {
			return err
		}
		return nil
	}

	// Total paid amount is below the TotalPremiumToPay, so no action required
	return fmt.Errorf("total paid amount is below the TotalPremiumToPay")
}

func (s *SmartContract) Cancel(ctx contractapi.TransactionContextInterface, id int) error {
	// Retrieve the policy
	policy, err := s.ReadPolicy(ctx, id)
	if err != nil {
		return err
	}

	if policy.PolicyStatus == Cancelled {
		return fmt.Errorf("coverage for this policy has already been Cancelled")
	}

	// Check if the total paid amount is less than the TotalPremiumToPay
	if policy.TotalPaid < policy.TotalPremiumToPay {

		// Transfer TotalPaid amount to the user's balance
		policy.UserBalance += policy.TotalPaid

		// Update policy status to Cancelled
		policy.PolicyStatus = Cancelled

		// Marshal the updated policy to JSON
		policyJSON, err := json.Marshal(policy)
		if err != nil {
			return err
		}
		// Store the updated policy in the ledger
		err = ctx.GetStub().PutState(strconv.Itoa(id), policyJSON)
		if err != nil {
			return err
		}
		return nil
	}

	// Total paid amount is below the TotalPremiumToPay, so no action required
	return fmt.Errorf("total paid amount is below the TotalPremiumToPay")
}

// GetTotalPaid returns the total premium paid for the policy with the given id
func (s *SmartContract) GetTotalPaid(ctx contractapi.TransactionContextInterface, id int) (float64, error) {
	policy, err := s.ReadPolicy(ctx, id)
	if err != nil {
		return 0, err
	}

	return policy.TotalPaid, nil
}

// GetAllPolicies returns all policies stored in the ledger
func (s *SmartContract) GetAllPolicies(ctx contractapi.TransactionContextInterface) ([]Policy, error) {
	// Get the total number of policies
	totalPolicies, err := s.GetTotalPoliciesCount(ctx)
	if err != nil {
		return nil, err
	}

	// If there are no policies, return an empty slice
	if totalPolicies == 0 {
		return []Policy{}, nil
	}

	// Define the range for querying policies
	startKey := "0"
	endKey := strconv.Itoa(totalPolicies + 1)

	resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var policies []Policy
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var policy Policy
		err = json.Unmarshal(queryResponse.Value, &policy)
		if err != nil {
			return nil, err
		}
		policies = append(policies, policy)
	}

	return policies, nil
}

// GetTotalPoliciesCount returns the total number of policies stored in the ledger
func (s *SmartContract) GetTotalPoliciesCount(ctx contractapi.TransactionContextInterface) (int, error) {
	counterBytes, err := ctx.GetStub().GetState(counterKey)
	if err != nil {
		return 0, fmt.Errorf("failed to get counter: %v", err)
	}

	if counterBytes == nil {
		return 0, fmt.Errorf("counter does not exist")
	}

	counter, err := strconv.Atoi(string(counterBytes))
	if err != nil {
		return 0, fmt.Errorf("failed to convert counter to int: %v", err)
	}

	return counter, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting chaincode: %v", err)
	}
}
